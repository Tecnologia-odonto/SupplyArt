import React, { useEffect, useState } from 'react';
import { formatDBDateForDisplay } from '../../utils/dateHelper';
import { 
  EyeIcon, 
  ChartBarIcon,
  CalendarIcon,
  BuildingOffice2Icon,
  CurrencyDollarIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import QuotationComparison from './QuotationComparison';
import toast from 'react-hot-toast';

interface ItemQuotationsListProps {
  itemCode: string;
  onClose: () => void;
  onUpdate: () => void;
}

interface QuotationWithResponses {
  id: string;
  title: string;
  status: string;
  deadline: string | null;
  created_at: string;
  purchase: {
    id: string;
    unit: { name: string };
  } | null;
  responses: Array<{
    id: string;
    supplier: { name: string };
    unit_price: number;
    delivery_time: number | null;
    is_selected: boolean;
  }>;
  suppliers_count: number;
  best_price: number | null;
  best_supplier: string | null;
}

const ItemQuotationsList: React.FC<ItemQuotationsListProps> = ({ itemCode, onClose, onUpdate }) => {
  const [quotations, setQuotations] = useState<QuotationWithResponses[]>([]);
  const [itemInfo, setItemInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [comparisonModalOpen, setComparisonModalOpen] = useState(false);
  const [selectedQuotation, setSelectedQuotation] = useState<any>(null);

  useEffect(() => {
    fetchItemInfo();
    fetchQuotationsForItem();
  }, [itemCode]);

  const fetchItemInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('id, code, name, unit_measure, category')
        .eq('code', itemCode)
        .single();

      if (error) throw error;
      setItemInfo(data);
    } catch (error) {
      console.error('Error fetching item info:', error);
    }
  };

  const fetchQuotationsForItem = async () => {
    try {
      // Buscar todas as cotações que têm este item
      const { data: quotationIds, error: quotationIdsError } = await supabase
        .from('quotation_responses')
        .select('quotation_id')
        .eq('item_code', itemCode);

      if (quotationIdsError) throw quotationIdsError;

      if (!quotationIds || quotationIds.length === 0) {
        setQuotations([]);
        setLoading(false);
        return;
      }

      const uniqueQuotationIds = [...new Set(quotationIds.map(q => q.quotation_id))];

      // Buscar detalhes das cotações
      const { data: quotationsData, error: quotationsError } = await supabase
        .from('quotations')
        .select(`
          id,
          title,
          status,
          deadline,
          created_at,
          purchase:purchases(
            id,
            unit:units(name)
          )
        `)
        .in('id', uniqueQuotationIds)
        .order('created_at', { ascending: false });

      if (quotationsError) throw quotationsError;

      // Para cada cotação, buscar as respostas deste item
      const quotationsWithResponses = await Promise.all((quotationsData || []).map(async (quotation) => {
        const { data: responses, error: responsesError } = await supabase
          .from('quotation_responses')
          .select(`
            id,
            supplier:suppliers(name),
            unit_price,
            delivery_time,
            is_selected
          `)
          .eq('quotation_id', quotation.id)
          .eq('item_code', itemCode);

        if (responsesError) throw responsesError;

        // Calcular estatísticas
        const prices = responses?.map(r => r.unit_price).filter(p => p > 0) || [];
        const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
        const bestSupplier = bestPrice ? responses?.find(r => r.unit_price === bestPrice)?.supplier?.name : null;

        return {
          ...quotation,
          responses: responses || [],
          suppliers_count: responses?.length || 0,
          best_price: bestPrice,
          best_supplier: bestSupplier
        };
      }));

      setQuotations(quotationsWithResponses);
    } catch (error) {
      console.error('Error fetching quotations for item:', error);
      toast.error('Erro ao carregar cotações do item');
    } finally {
      setLoading(false);
    }
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

  const columns = [
    {
      key: 'title',
      title: 'Título da Cotação',
      render: (value: string, record: QuotationWithResponses) => (
        <div>
          <div className="font-medium">{value}</div>
          {record.purchase && (
            <div className="text-sm text-gray-500">
              Pedido: #{record.purchase.id.slice(0, 8)} - {record.purchase.unit?.name}
            </div>
          )}
        </div>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'suppliers_count',
      title: 'Fornecedores',
      render: (value: number) => (
        <Badge variant="info">{value}</Badge>
      )
    },
    {
      key: 'best_price',
      title: 'Melhor Preço',
      render: (value: number | null, record: QuotationWithResponses) => value ? (
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
      key: 'deadline',
      title: 'Prazo',
      render: (value: string | null) => value ? (
        <div>
          <div className="text-sm">{formatDBDateForDisplay(value)}</div>
          {new Date(value) < new Date() && (
            <Badge variant="error" size="sm">Vencido</Badge>
          )}
        </div>
      ) : '-'
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => formatDBDateForDisplay(value)
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: QuotationWithResponses) => (
        <div className="flex space-x-1 sm:space-x-2">
          {record.suppliers_count > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setSelectedQuotation(record);
                setComparisonModalOpen(true);
              }}
              title="Comparar preços"
            >
              <ChartBarIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              Comparar
            </Button>
          )}
        </div>
      ),
    },
  ];

  const totalResponses = quotations.reduce((sum, q) => sum + q.suppliers_count, 0);
  const quotationsWithPrices = quotations.filter(q => q.best_price !== null).length;

  return (
    <div className="space-y-6">
      {/* Informações do Item */}
      {itemInfo && (
        <Card>
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium text-gray-900">
                {itemInfo.name}
              </h3>
              <p className="text-sm text-gray-500">
                Código: {itemInfo.code} | Unidade: {itemInfo.unit_measure}
                {itemInfo.category && ` | Categoria: ${itemInfo.category}`}
              </p>
            </div>
            <Button variant="outline" onClick={onClose}>
              Fechar
            </Button>
          </div>
        </Card>
      )}

      {/* Estatísticas */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">📋</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Cotações</p>
              <p className="text-lg font-semibold text-gray-900">{quotations.length}</p>
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
                <CurrencyDollarIcon className="w-5 h-5 text-success-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Com Preços</p>
              <p className="text-lg font-semibold text-gray-900">{quotationsWithPrices}</p>
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
                {quotations.length - quotationsWithPrices}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Lista de Cotações */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">
            Cotações para o Item: {itemCode}
          </h3>
        </div>
        
        <Table
          columns={columns}
          data={quotations}
          loading={loading}
          emptyMessage={`Nenhuma cotação encontrada para o item ${itemCode}`}
        />
      </Card>

      {/* Modal de Comparação */}
      <Modal
        isOpen={comparisonModalOpen}
        onClose={() => {
          setComparisonModalOpen(false);
          setSelectedQuotation(null);
        }}
        title="Comparação de Preços"
        size="xl"
      >
        {selectedQuotation && (
          <QuotationComparison
            quotation={selectedQuotation}
            onClose={() => {
              setComparisonModalOpen(false);
              setSelectedQuotation(null);
            }}
            onUpdate={() => {
              fetchQuotationsForItem();
              onUpdate();
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default ItemQuotationsList;