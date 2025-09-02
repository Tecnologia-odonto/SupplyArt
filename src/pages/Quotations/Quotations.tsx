import React, { useEffect, useState } from 'react';
import { 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  DocumentTextIcon,
  ClipboardDocumentListIcon,
  FunnelIcon,
  ChartBarIcon,
  BuildingOffice2Icon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import QuotationForm from './QuotationForm';
import QuotationDetails from './QuotationDetails';
import toast from 'react-hot-toast';

interface QuotationWithDetails {
  id: string;
  title: string;
  description: string | null;
  status: 'rascunho' | 'enviada' | 'em_analise' | 'finalizada' | 'cancelada';
  deadline: string | null;
  created_at: string;
  purchase: {
    id: string;
    unit: {
      name: string;
    };
  } | null;
  created_by_profile: {
    name: string;
  } | null;
  items_count: number;
  responses_count: number;
}

const Quotations: React.FC = () => {
  const [quotations, setQuotations] = useState<QuotationWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingQuotation, setEditingQuotation] = useState<any>(null);
  const [viewingQuotation, setViewingQuotation] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    unit_id: ''
  });
  const [units, setUnits] = useState<any[]>([]);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchUnits();
    fetchQuotations();
  }, []);

  useEffect(() => {
    fetchQuotations();
  }, [filters]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('is_cd', true)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchQuotations = async () => {
    try {
      let query = supabase
        .from('quotations')
        .select(`
          id,
          title,
          description,
          status,
          deadline,
          created_at,
          purchase:purchases(
            id,
            unit:units(name)
          ),
          created_by_profile:profiles!quotations_created_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros baseados no role do usuário
      if (profile?.role === 'operador-almoxarife' && profile.unit_id) {
        // Op. Almoxarife: apenas cotações do seu CD
        query = query.eq('purchase.unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: apenas cotações da sua unidade
        query = query.eq('purchase.unit_id', profile.unit_id);
      }
      // Admin e Op. Financeiro podem ver todas

      // Aplicar filtros da interface
      if (filters.status) {
        query = query.eq('status', filters.status);
      }

      const { data, error } = await query;
      if (error) throw error;

      // Para cada cotação, buscar contagem de itens e respostas
      const quotationsWithCounts = await Promise.all((data || []).map(async (quotation) => {
        // Contar itens da cotação
        const { count: itemsCount } = await supabase
          .from('quotation_items')
          .select('id', { count: 'exact', head: true })
          .eq('quotation_id', quotation.id);

        // Contar respostas da cotação
        const { count: responsesCount } = await supabase
          .from('quotation_responses')
          .select('id', { count: 'exact', head: true })
          .eq('quotation_id', quotation.id);

        return {
          ...quotation,
          items_count: itemsCount || 0,
          responses_count: responsesCount || 0
        };
      }));

      setQuotations(quotationsWithCounts);
    } catch (error) {
      console.error('Error fetching quotations:', error);
      toast.error('Erro ao carregar cotações');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile || !['admin', 'gestor', 'operador-almoxarife'].includes(profile.role)) {
      toast.error('Você não tem permissão para excluir cotações');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta cotação?')) {
      try {
        const { error } = await supabase
          .from('quotations')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setQuotations(quotations.filter(quotation => quotation.id !== id));
        toast.success('Cotação excluída com sucesso!');
      } catch (error) {
        console.error('Error deleting quotation:', error);
        toast.error('Erro ao excluir cotação');
      }
    }
  };

  const handleQuotationSaved = () => {
    fetchQuotations();
    setModalOpen(false);
    setEditingQuotation(null);
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

  const getVisibilityInfo = () => {
    if (!profile) return null;
    
    switch (profile.role) {
      case 'gestor':
        return 'Visualizando cotações da sua unidade';
      case 'operador-almoxarife':
        return 'Visualizando cotações do seu CD';
      case 'operador-financeiro':
        return 'Visualizando todas as cotações (somente leitura)';
      default:
        return null;
    }
  };

  const canCreate = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);
  const canEdit = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);
  const canDelete = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);

  const columns = [
    {
      key: 'title',
      title: 'Título da Cotação',
      render: (value: string, record: QuotationWithDetails) => (
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
      key: 'items_count',
      title: 'Itens',
      render: (value: number) => (
        <Badge variant="info">{value}</Badge>
      )
    },
    {
      key: 'responses_count',
      title: 'Respostas',
      render: (value: number) => (
        <Badge variant="default">{value}</Badge>
      )
    },
    {
      key: 'deadline',
      title: 'Prazo',
      render: (value: string | null) => value ? (
        <div>
          <div className="text-sm">{new Date(value).toLocaleDateString('pt-BR')}</div>
          {new Date(value) < new Date() && (
            <Badge variant="error" size="sm">Vencido</Badge>
          )}
        </div>
      ) : '-'
    },
    {
      key: 'created_by_profile',
      title: 'Criado por',
      render: (profile: any) => profile?.name || '-'
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: QuotationWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setViewingQuotation(record);
              setDetailsModalOpen(true);
            }}
          >
            <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            Ver Cotações
          </Button>
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingQuotation(record);
                setModalOpen(true);
              }}
            >
              <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
          {canDelete && record.status === 'rascunho' && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(record.id)}
            >
              Excluir
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!permissions.canAccessQuotations) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar cotações de compras.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Cotações de Compras</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie cotações de fornecedores para pedidos de compra
          </p>
          {getVisibilityInfo() && (
            <p className="mt-1 text-xs text-blue-600 font-medium">
              {getVisibilityInfo()}
            </p>
          )}
        </div>
        {canCreate && (
          <Button
            onClick={() => {
              setEditingQuotation(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Nova Cotação
          </Button>
        )}
      </div>

      {/* Informação sobre o módulo */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <DocumentTextIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 mb-2">📋 Sistema de Cotações</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>1. Nova Cotação:</strong> Cria uma cotação geral baseada em um pedido de compra</p>
              <p><strong>2. Ver Cotações:</strong> Mostra todos os itens da cotação para adicionar preços</p>
              <p><strong>3. Cotações Individuais:</strong> Cada item pode ter múltiplas cotações de fornecedores</p>
              <p><strong>4. Comparação:</strong> Compare preços e selecione os melhores fornecedores</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex items-center mb-4">
          <FunnelIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="filter_status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="filter_status"
              value={filters.status}
              onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todos os status</option>
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="em_analise">Em Análise</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="filter_unit" className="block text-sm font-medium text-gray-700 mb-1">
              Centro de Distribuição
            </label>
            <select
              id="filter_unit"
              value={filters.unit_id}
              onChange={(e) => setFilters(prev => ({ ...prev, unit_id: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todos os CDs</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setFilters({ status: '', unit_id: '' })}
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <DocumentTextIcon className="w-4 h-4 sm:w-5 sm:h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total Cotações</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {quotations.length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-xs sm:text-sm">📝</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Rascunho</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {quotations.filter(q => q.status === 'rascunho').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-xs sm:text-sm">📤</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Enviadas</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {quotations.filter(q => q.status === 'enviada').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-xs sm:text-sm">✅</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Finalizadas</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {quotations.filter(q => q.status === 'finalizada').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-error-100 rounded-full flex items-center justify-center">
                <span className="text-error-600 font-semibold text-xs sm:text-sm">❌</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Canceladas</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {quotations.filter(q => q.status === 'cancelada').length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={quotations}
          loading={loading}
          emptyMessage="Nenhuma cotação encontrada"
        />
      </Card>

      {/* Modal de Formulário */}
      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingQuotation(null);
        }}
        title={editingQuotation ? 'Editar Cotação' : 'Nova Cotação'}
        size="lg"
      >
        <QuotationForm
          quotation={editingQuotation}
          onSave={handleQuotationSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingQuotation(null);
          }}
        />
      </Modal>

      {/* Modal de Detalhes */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setViewingQuotation(null);
        }}
        title="Detalhes da Cotação"
        size="xl"
      >
        {viewingQuotation && (
          <QuotationDetails
            quotation={viewingQuotation}
            onClose={() => {
              setDetailsModalOpen(false);
              setViewingQuotation(null);
            }}
            onUpdate={fetchQuotations}
          />
        )}
      </Modal>
    </div>
  );
};

export default Quotations;