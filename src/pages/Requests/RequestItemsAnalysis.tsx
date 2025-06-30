import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Button from '../../components/UI/Button';
import { createAuditLog } from '../../utils/auditLogger';
import toast from 'react-hot-toast';

interface RequestItemsAnalysisProps {
  requestId: string;
  cdUnitId: string;
  onSave: () => void;
  onCancel: () => void;
}

interface RequestItemWithStock {
  id: string;
  item_id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  cd_stock_available: number | null;
  needs_purchase: boolean;
  notes: string | null;
  item: {
    name: string;
    code: string;
    unit_measure: string;
  };
}

const RequestItemsAnalysis: React.FC<RequestItemsAnalysisProps> = ({ 
  requestId, 
  cdUnitId, 
  onSave, 
  onCancel 
}) => {
  const [items, setItems] = useState<RequestItemWithStock[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchRequestItems();
  }, [requestId, cdUnitId]);

  const fetchRequestItems = async () => {
    try {
      // Buscar itens do pedido
      const { data: requestItems, error: requestItemsError } = await supabase
        .from('request_items')
        .select(`
          *,
          item:items(id, name, code, unit_measure)
        `)
        .eq('request_id', requestId);

      if (requestItemsError) throw requestItemsError;

      // Para cada item, verificar estoque disponível no CD
      const itemsWithStock = await Promise.all((requestItems || []).map(async (item) => {
        const { data: stockData } = await supabase
          .from('stock')
          .select('quantity')
          .eq('item_id', item.item_id)
          .eq('unit_id', cdUnitId)
          .single();

        return {
          ...item,
          cd_stock_available: stockData?.quantity || 0,
          quantity_approved: item.quantity_approved || item.quantity_requested,
          needs_purchase: item.needs_purchase || (stockData?.quantity || 0) < item.quantity_requested
        };
      }));

      setItems(itemsWithStock);
    } catch (error) {
      console.error('Error fetching request items:', error);
      toast.error('Erro ao carregar itens do pedido');
    } finally {
      setLoading(false);
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...items];
    updated[index] = { ...updated[index], [field]: value };
    setItems(updated);
  };

  const handleSaveAnalysis = async () => {
    try {
      setSaving(true);

      // Atualizar status do pedido para "analisando"
      await supabase
        .from('requests')
        .update({ status: 'analisando' })
        .eq('id', requestId);

      // Atualizar cada item com as informações de análise
      for (const item of items) {
        await supabase
          .from('request_items')
          .update({
            quantity_approved: item.quantity_approved,
            cd_stock_available: item.cd_stock_available,
            needs_purchase: item.needs_purchase
          })
          .eq('id', item.id);
      }

      // Criar log de auditoria
      await createAuditLog({
        action: 'REQUEST_ITEMS_ANALYZED',
        tableName: 'request_items',
        recordId: requestId,
        newValues: {
          items: items.map(item => ({
            id: item.id,
            quantity_approved: item.quantity_approved,
            cd_stock_available: item.cd_stock_available,
            needs_purchase: item.needs_purchase
          }))
        }
      });

      toast.success('Análise salva com sucesso!');
      onSave();
    } catch (error) {
      console.error('Error saving analysis:', error);
      toast.error('Erro ao salvar análise');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">Análise de Disponibilidade</h4>
        <p className="text-xs text-blue-700">
          Verifique a disponibilidade de cada item no estoque do CD. Ajuste as quantidades aprovadas 
          e marque os itens que precisarão ser comprados.
        </p>
      </div>

      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qtd. Solicitada
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Estoque CD
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Qtd. Aprovada
              </th>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Precisa Comprar?
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {items.map((item, index) => (
              <tr key={item.id} className={item.cd_stock_available < item.quantity_requested ? 'bg-yellow-50' : ''}>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div>
                    <div className="text-sm font-medium text-gray-900">{item.item.name}</div>
                    <div className="text-sm text-gray-500">{item.item.code}</div>
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                  {item.quantity_requested} {item.item.unit_measure}
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className={`text-sm ${item.cd_stock_available < item.quantity_requested ? 'text-red-600 font-medium' : 'text-gray-900'}`}>
                    {item.cd_stock_available} {item.item.unit_measure}
                    {item.cd_stock_available < item.quantity_requested && (
                      <span className="block text-xs text-red-500">
                        Estoque insuficiente
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <input
                    type="number"
                    min="0"
                    max={item.quantity_requested}
                    value={item.quantity_approved || 0}
                    onChange={(e) => updateItem(index, 'quantity_approved', Number(e.target.value))}
                    className="w-20 rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  />
                </td>
                <td className="px-6 py-4 whitespace-nowrap">
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      checked={item.needs_purchase}
                      onChange={(e) => updateItem(index, 'needs_purchase', e.target.checked)}
                      className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                    />
                    <label className="ml-2 block text-sm text-gray-900">
                      Comprar
                    </label>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSaveAnalysis} 
          loading={saving}
        >
          Salvar Análise
        </Button>
      </div>
    </div>
  );
};

export default RequestItemsAnalysis;