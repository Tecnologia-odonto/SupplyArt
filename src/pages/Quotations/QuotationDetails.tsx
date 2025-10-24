import React, { useEffect, useState } from 'react';
import { 
  PlusIcon, 
  DocumentArrowUpIcon, 
  TrashIcon,
  BuildingOffice2Icon,
  CurrencyDollarIcon,
  ChartBarIcon,
  EyeIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import QuotationResponseForm from './QuotationResponseForm';
import SpreadsheetImport from './SpreadsheetImport';
import QuotationComparison from './QuotationComparison';
import toast from 'react-hot-toast';

interface QuotationDetailsProps {
  quotation: any;
  onClose: () => void;
  onUpdate: () => void;
}

interface QuotationItemWithDetails {
  id: string;
  quantity: number;
  item: {
    id: string;
    name: string;
    code: string;
    unit_measure: string;
  };
  responses_count: number;
  best_price: number | null;
  best_supplier: string | null;
  has_responses: boolean;
}

const QuotationDetails: React.FC<QuotationDetailsProps> = ({ quotation, onClose, onUpdate }) => {
  const [quotationItems, setQuotationItems] = useState<QuotationItemWithDetails[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [responseModalOpen, setResponseModalOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [itemQuotationsModalOpen, setItemQuotationsModalOpen] = useState(false);
  const { profile } = useAuth();

  useEffect(() => {
    fetchQuotationData();
    fetchSuppliers();
  }, [quotation.id]);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
    }
  };

  const fetchQuotationData = async () => {
    try {
      // Buscar itens da cotação
      const { data: itemsData, error: itemsError } = await supabase
        .from('quotation_items')
        .select(`
          *,
          item:items(id, name, code, unit_measure)
        `)
        .eq('quotation_id', quotation.id);

      if (itemsError) throw itemsError;

      // Para cada item, buscar estatísticas das respostas
      const itemsWithStats = await Promise.all((itemsData || []).map(async (item) => {
        const { data: responses, error: responsesError } = await supabase
          .from('quotation_responses')
          .select(`
            id,
            unit_price,
            supplier:suppliers(name)
          `)
          .eq('quotation_id', quotation.id)
          .eq('item_id', item.item_id);

        if (responsesError) throw responsesError;

        // Calcular estatísticas
        const prices = responses?.map(r => r.unit_price).filter(p => p > 0) || [];
        const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
        const bestSupplier = bestPrice ? responses?.find(r => r.unit_price === bestPrice)?.supplier?.name : null;

        return {
          ...item,
          responses_count: responses?.length || 0,
          best_price: bestPrice,
          best_supplier: bestSupplier,
          has_responses: (responses?.length || 0) > 0
        };
      }));

      setQuotationItems(itemsWithStats);
    } catch (error) {
      console.error('Error fetching quotation data:', error);
      toast.error('Erro ao carregar dados da cotação');
    } finally {
      setLoading(false);
    }
  };

  const handleResponseSaved = () => {
    fetchQuotationData();
    setResponseModalOpen(false);
    setSelectedItem(null);
  };

  const handleImportCompleted = () => {
    fetchQuotationData();
    setImportModalOpen(false);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'rascunho': { variant: 'default' as const, label: 'Rascunho' },
      'enviada': { variant: 'info' as const, label: 'Enviada' },
      'em_analise': { variant: 'warning' as const, label: 'Em Análise' },
      'finalizada': { variant: 'success' as const, label: 'Finalizada' },
      'cancelada': { variant: 'error' as const, label: 'Cancelada' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const canAddQuotations = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);

  const columns = [
    {
      key: 'item',
      title: 'Item',
      render: (item: any) => (
        <div>
          <div className="font-medium">{item.name}</div>
          <div className="text-sm text-gray-500">{item.code}</div>
        </div>
      )
    },
    {
      key: 'quantity',
      title: 'Quantidade',
      render: (value: number, record: QuotationItemWithDetails) => (
        <span>{value} {record.item.unit_measure}</span>
      )
    },
    {
      key: 'responses_count',
      title: 'Cotações Recebidas',
      render: (value: number) => (
        <Badge variant={value > 0 ? 'success' : 'default'}>{value}</Badge>
      )
    },
    {
      key: 'best_price',
      title: 'Melhor Preço',
      render: (value: number | null, record: QuotationItemWithDetails) => value ? (
        <div>
          <div className="font-medium text-success-600">
            R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </div>
          <div className="text-xs text-gray-500">{record.best_supplier}</div>
        </div>
      ) : (
        <span className="text-gray-500">Sem cotação</span>
      )
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: QuotationItemWithDetails) => (
        <div className="flex space-x-1">
          {canAddQuotations && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedItem(record);
                setResponseModalOpen(true);
              }}
            >
              <PlusIcon className="w-3 h-3 mr-1" />
              Nova Cotação
            </Button>
          )}
          {record.has_responses && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedItem(record);
                setItemQuotationsModalOpen(true);
              }}
            >
              <ChartBarIcon className="w-3 h-3 mr-1" />
              Ver Todas as Cotações
            </Button>
          )}
        </div>
      )
    }
  ];

  const totalResponses = quotationItems.reduce((sum, item) => sum + item.responses_count, 0);
  const itemsWithResponses = quotationItems.filter(item => item.responses_count > 0).length;

  return (
    <div className="space-y-6">
      {/* Informações da Cotação */}
      <Card>
        <div className="flex justify-between items-start mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">{quotation.title}</h3>
            <p className="text-sm text-gray-500">
              Pedido: #{quotation.purchase?.id?.slice(0, 8)} - {quotation.purchase?.unit?.name}
            </p>
          </div>
          <div className="flex space-x-2">
            {canAddQuotations && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => setImportModalOpen(true)}
              >
                <DocumentArrowUpIcon className="w-4 h-4 mr-1" />
                Importar Planilha
              </Button>
            )}
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Status</label>
            <div className="mt-1">{getStatusBadge(quotation.status)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Prazo</label>
            <p className="mt-1 text-sm text-gray-900">
              {quotation.deadline ? formatDBDateForDisplay(quotation.deadline) : 'Não definido'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Criado por</label>
            <p className="mt-1 text-sm text-gray-900">{quotation.created_by_profile?.name}</p>
          </div>
        </div>

        {quotation.description && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-500">Descrição</label>
            <p className="mt-1 text-sm text-gray-900">{quotation.description}</p>
          </div>
        )}
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">📦</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Itens</p>
              <p className="text-lg font-semibold text-gray-900">{quotationItems.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                <BuildingOffice2Icon className="w-5 h-5 text-info-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Respostas</p>
              <p className="text-lg font-semibold text-gray-900">{totalResponses}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-sm">✓</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Itens Cotados</p>
              <p className="text-lg font-semibold text-gray-900">{itemsWithResponses}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-sm">⏳</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Pendentes</p>
              <p className="text-lg font-semibold text-gray-900">
                {quotationItems.length - itemsWithResponses}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Instruções */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Como Cotar os Itens</h4>
        <div className="text-xs text-blue-700 space-y-1">
          <p><strong>Nova Cotação:</strong> Clique no botão "Nova Cotação" de cada item para adicionar preços de fornecedores</p>
          <p><strong>Ver Todas:</strong> Clique em "Ver Todas" para comparar todas as cotações de um item</p>
          <p><strong>Importar Planilha:</strong> Use para importar múltiplas cotações de uma vez</p>
        </div>
      </div>

      {/* Itens da Cotação */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Itens para Cotação</h3>
          {canAddQuotations && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setImportModalOpen(true)}
            >
              <DocumentArrowUpIcon className="w-4 h-4 mr-1" />
              Importar Planilha
            </Button>
          )}
        </div>
        
        <Table
          columns={columns}
          data={quotationItems}
          loading={loading}
          emptyMessage="Nenhum item encontrado na cotação"
        />
      </Card>

      {/* Modal de Nova Cotação Individual */}
      <Modal
        isOpen={responseModalOpen}
        onClose={() => {
          setResponseModalOpen(false);
          setSelectedItem(null);
        }}
        title="Nova Cotação do Fornecedor"
        size="lg"
      >
        <React.Suspense fallback={
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            <span className="ml-2 text-gray-600">Carregando...</span>
          </div>
        }>
          {selectedItem ? (
            <QuotationResponseForm
              quotationId={quotation.id}
              item={selectedItem}
              suppliers={suppliers}
              onSave={handleResponseSaved}
              onCancel={() => {
                setResponseModalOpen(false);
                setSelectedItem(null);
              }}
            />
          ) : (
            <div className="flex flex-col items-center justify-center p-8 space-y-4">
              <div className="text-center">
                <span className="text-4xl">⚠️</span>
                <h3 className="mt-2 text-lg font-medium text-gray-900">Dados Insuficientes</h3>
                <p className="mt-1 text-sm text-gray-600">Dados insuficientes para nova cotação</p>
              </div>
              <Button onClick={() => {
                setResponseModalOpen(false);
                setSelectedItem(null);
              }} variant="outline">
                Voltar
              </Button>
            </div>
          )}
        </React.Suspense>
      </Modal>

      {/* Modal de Importação */}
      <Modal
        isOpen={importModalOpen}
        onClose={() => setImportModalOpen(false)}
        title="Importar Planilha de Cotações"
        size="lg"
      >
        <SpreadsheetImport
          quotationId={quotation.id}
          quotationItems={quotationItems}
          suppliers={suppliers}
          onImport={handleImportCompleted}
          onCancel={() => setImportModalOpen(false)}
        />
      </Modal>

      {/* Modal de Comparação */}
      <Modal
        isOpen={itemQuotationsModalOpen}
        onClose={() => {
          setItemQuotationsModalOpen(false);
          setSelectedItem(null);
        }}
        title="Todas as Cotações do Item"
        size="xl"
      >
        {selectedItem && (
          <QuotationComparison
            quotation={{
              ...quotation,
              selectedItem: selectedItem
            }}
            onClose={() => {
              setItemQuotationsModalOpen(false);
              setSelectedItem(null);
            }}
            onUpdate={() => {
              fetchQuotationData();
              onUpdate();
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default QuotationDetails;