import React, { useState } from 'react';
import { DocumentArrowUpIcon, InformationCircleIcon } from '@heroicons/react/24/outline';
import Button from '../../components/UI/Button';
import Card from '../../components/UI/Card';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface SpreadsheetImportProps {
  quotationId: string;
  quotationItems: any[];
  suppliers: any[];
  onImport: () => void;
  onCancel: () => void;
}

interface ImportData {
  item_code: string;
  supplier_id: string;
  unit_price: number;
  delivery_time?: number;
  notes?: string;
}

const SpreadsheetImport: React.FC<SpreadsheetImportProps> = ({ 
  quotationId, 
  quotationItems, 
  suppliers, 
  onImport, 
  onCancel 
}) => {
  const [file, setFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const [previewData, setPreviewData] = useState<ImportData[]>([]);
  const [showPreview, setShowPreview] = useState(false);

  const generateTemplate = () => {
    // Criar template CSV
    const headers = [
      'item_code',
      'item_name', 
      'quantity',
      'unit_measure',
      'supplier_name',
      'unit_price',
      'delivery_time_days',
      'notes'
    ];

    const rows = quotationItems.map(item => [
      item.item.code,
      item.item.name,
      item.quantity,
      item.item.unit_measure,
      '', // supplier_name - para preencher
      '', // unit_price - para preencher
      '', // delivery_time_days - opcional
      ''  // notes - opcional
    ]);

    const csvContent = [headers, ...rows]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `template_cotacao_${quotationId.slice(0, 8)}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    toast.success('Template baixado! Preencha os preços e reimporte o arquivo.');
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      parseFile(selectedFile);
    }
  };

  const parseFile = async (file: File) => {
    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      
      if (lines.length < 2) {
        toast.error('Arquivo deve conter pelo menos cabeçalho e uma linha de dados');
        return;
      }

      const headers = lines[0].split(',').map(h => h.replace(/"/g, '').trim());
      const dataLines = lines.slice(1);

      // Validar cabeçalhos obrigatórios
      const requiredHeaders = ['item_code', 'supplier_name', 'unit_price'];
      const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
      
      if (missingHeaders.length > 0) {
        toast.error(`Cabeçalhos obrigatórios faltando: ${missingHeaders.join(', ')}`);
        return;
      }

      const parsedData: ImportData[] = [];

      for (const line of dataLines) {
        const values = line.split(',').map(v => v.replace(/"/g, '').trim());
        const rowData: any = {};
        
        headers.forEach((header, index) => {
          rowData[header] = values[index] || '';
        });

        // Validar dados obrigatórios
        if (!rowData.item_code || !rowData.supplier_name || !rowData.unit_price) {
          continue; // Pular linhas incompletas
        }

        // Encontrar supplier_id pelo nome
        const supplier = suppliers.find(s => 
          s.name.toLowerCase().includes(rowData.supplier_name.toLowerCase()) ||
          rowData.supplier_name.toLowerCase().includes(s.name.toLowerCase())
        );

        if (!supplier) {
          toast.error(`Fornecedor não encontrado: ${rowData.supplier_name}`);
          continue;
        }

        // Validar se o item existe na cotação pelo código
        const quotationItem = quotationItems.find(qi => qi.item.code === rowData.item_code);
        if (!quotationItem) {
          toast.error(`Item não encontrado na cotação: ${rowData.item_code}`);
          continue;
        }

        parsedData.push({
          item_code: rowData.item_code,
          supplier_id: supplier.id,
          unit_price: parseFloat(rowData.unit_price) || 0,
          delivery_time: rowData.delivery_time_days ? parseInt(rowData.delivery_time_days) : undefined,
          notes: rowData.notes || undefined
        });
      }

      if (parsedData.length === 0) {
        toast.error('Nenhum dado válido encontrado no arquivo');
        return;
      }

      setPreviewData(parsedData);
      setShowPreview(true);
      toast.success(`${parsedData.length} cotações encontradas no arquivo`);
    } catch (error) {
      console.error('Error parsing file:', error);
      toast.error('Erro ao processar arquivo. Verifique o formato.');
    }
  };

  const handleImport = async () => {
    if (previewData.length === 0) {
      toast.error('Nenhum dado para importar');
      return;
    }

    try {
      setImporting(true);

      // Preparar dados para inserção
      const responsesToInsert = await Promise.all(previewData.map(async (data) => {
        // Buscar item_id pelo código
        const { data: itemData } = await supabase
          .from('items')
          .select('id')
          .eq('code', data.item_code)
          .single();

        return {
        quotation_id: quotationId,
        supplier_id: data.supplier_id,
        item_id: itemData?.id,
        item_code: data.item_code,
        unit_price: data.unit_price,
        delivery_time: data.delivery_time || null,
        notes: data.notes || null
        };
      }));

      // Inserir respostas (usar upsert para evitar duplicatas)
      for (const response of responsesToInsert) {
        // Verificar se já existe
        const { data: existing } = await supabase
          .from('quotation_responses')
          .select('id')
          .eq('quotation_id', response.quotation_id)
          .eq('supplier_id', response.supplier_id)
          .eq('item_code', response.item_code)
          .maybeSingle();

        if (existing) {
          // Atualizar existente
          await supabase
            .from('quotation_responses')
            .update(response)
            .eq('id', existing.id);
        } else {
          // Inserir novo
          await supabase
            .from('quotation_responses')
            .insert(response);
        }
      }

      toast.success(`${responsesToInsert.length} cotações importadas com sucesso!`);
      onImport();
    } catch (error) {
      console.error('Error importing data:', error);
      toast.error('Erro ao importar dados');
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <InformationCircleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h4 className="text-sm font-medium text-blue-800 mb-2">📊 Importação de Planilha</h4>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>1.</strong> Baixe o template com os itens da cotação</p>
              <p><strong>2.</strong> Preencha os preços dos fornecedores</p>
              <p><strong>3.</strong> Importe o arquivo preenchido</p>
              <p><strong>Formato:</strong> CSV com colunas: item_id, supplier_name, unit_price, delivery_time_days, notes</p>
            </div>
          </div>
        </div>
      </div>

      {/* Download Template */}
      <Card>
        <div className="flex justify-between items-center">
          <div>
            <h4 className="text-lg font-medium text-gray-900">1. Baixar Template</h4>
            <p className="text-sm text-gray-500">
              Baixe o template com os itens desta cotação
            </p>
          </div>
          <Button
            variant="outline"
            onClick={generateTemplate}
          >
            <DocumentArrowUpIcon className="w-4 h-4 mr-2" />
            Baixar Template CSV
          </Button>
        </div>
      </Card>

      {/* Upload File */}
      <Card>
        <div className="space-y-4">
          <div>
            <h4 className="text-lg font-medium text-gray-900">2. Importar Arquivo Preenchido</h4>
            <p className="text-sm text-gray-500">
              Selecione o arquivo CSV preenchido com as cotações
            </p>
          </div>
          
          <div>
            <input
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileChange}
              className="block w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-medium file:bg-primary-50 file:text-primary-700 hover:file:bg-primary-100"
            />
          </div>
        </div>
      </Card>

      {/* Preview dos Dados */}
      {showPreview && previewData.length > 0 && (
        <Card>
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-medium text-gray-900">3. Preview dos Dados</h4>
            <Badge variant="info">{previewData.length} cotações</Badge>
          </div>
          
          <div className="overflow-x-auto max-h-60">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Item
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Fornecedor
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Preço Unit.
                  </th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                    Entrega
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {previewData.map((data, index) => {
                  const item = quotationItems.find(qi => qi.item.id === data.item_id);
                  const supplier = suppliers.find(s => s.id === data.supplier_id);
                  
                  return (
                    <tr key={index}>
                      <td className="px-4 py-2 text-sm">
                        {quotationItems.find(qi => qi.item.code === data.item_code)?.item.name} ({data.item_code})
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {suppliers.find(s => s.id === data.supplier_id)?.name}
                      </td>
                      <td className="px-4 py-2 text-sm font-medium">
                        R$ {data.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {data.delivery_time ? `${data.delivery_time} dias` : '-'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        {showPreview && previewData.length > 0 && (
          <Button
            onClick={handleImport}
            loading={importing}
          >
            <DocumentArrowUpIcon className="w-4 h-4 mr-2" />
            Importar {previewData.length} Cotações
          </Button>
        )}
      </div>
    </div>
  );
};

export default SpreadsheetImport;