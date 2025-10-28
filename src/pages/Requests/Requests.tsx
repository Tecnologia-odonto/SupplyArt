import React, { useEffect, useState } from 'react';
import { formatDBDateForDisplay, getTodayBrazilForInput} from '../../utils/dateHelper';
import { 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  CheckIcon, 
  XMarkIcon,
  ClockIcon,
  TruckIcon,
  ExclamationTriangleIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { createAuditLog } from '../../utils/auditLogger';
import RequestForm from './RequestForm';
import RequestDetails from './RequestDetails';
import toast from 'react-hot-toast';

interface RequestWithDetails {
  id: string;
  requesting_unit_id: string;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  total_estimated_cost: number;
  budget_consumed: boolean;
  requesting_unit: {
    name: string;
  };
  cd_unit: {
    name: string;
  };
  requester: {
    name: string;
  };
  approved_by_profile?: {
    name: string;
  } | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

const Requests: React.FC = () => {
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [viewingRequest, setViewingRequest] = useState<any>(null);
  const [filters, setFilters] = useState({
    status: '',
    priority: '',
    requesting_unit_id: ''
  });
  const [units, setUnits] = useState<any[]>([]);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchUnits();
    fetchRequests();
  }, []);

  useEffect(() => {
    fetchRequests();
  }, [filters]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('is_cd', false)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('requests')
        .select(`
          *,
          requesting_unit:units!requests_requesting_unit_id_fkey(name),
          cd_unit:units!requests_cd_unit_id_fkey(name),
          requester:profiles!requests_requester_id_fkey(name),
          approved_by_profile:profiles!requests_approved_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros baseados no role do usuário
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        // Op. Administrativo: todos os pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      } else if (profile?.role === 'operador-financeiro' && profile.unit_id) {
        // Op. Financeiro: pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      }
      // Admin e Op. Almoxarife podem ver todos (sem filtro adicional)

      // Aplicar filtros da interface
      if (filters.status) {
        query = query.eq('status', filters.status);
      }
      if (filters.priority) {
        query = query.eq('priority', filters.priority);
      }
      if (filters.requesting_unit_id) {
        query = query.eq('requesting_unit_id', filters.requesting_unit_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      // Verificar status de compras pendentes para pedidos aprovados
      const requestsWithUpdatedStatus = await Promise.all((data || []).map(async (request) => {
        if (request.status === 'aprovado') {
          // Verificar se há compras relacionadas a este pedido
          const { data: relatedPurchases } = await supabase
            .from('purchases')
            .select('status')
            .eq('request_id', request.id);
          
          if (relatedPurchases && relatedPurchases.length > 0) {
            const hasPendingPurchases = relatedPurchases.some(purchase => 
              purchase.status !== 'finalizado'
            );
            
            if (hasPendingPurchases) {
              // Atualizar status para aprovado-pendente
              await supabase
                .from('requests')
                .update({ status: 'aprovado-pendente' })
                .eq('id', request.id);
              
              return { ...request, status: 'aprovado-pendente' };
            } else {
              // Todas as compras foram finalizadas, voltar para aprovado
              return request;
            }
          }
        }
        
        return request;
      }));
      
      // Atualizar status dos pedidos baseado em itens em rota
      const requestsWithUpdatedStatus2 = await Promise.all(requestsWithUpdatedStatus.map(async (request) => {
        // Verificar se há itens deste pedido em rota
        const { data: emRotaItems } = await supabase
          .from('em_rota')
          .select('status')
          .eq('request_id', request.id);
        
        if (emRotaItems && emRotaItems.length > 0) {
          const allDelivered = emRotaItems.every(item => item.status === 'entregue');
          const anyInTransit = emRotaItems.some(item => item.status === 'em_transito');
          
          let updatedStatus = request.status;
          
          if (allDelivered && request.status !== 'aprovado-unidade') {
            updatedStatus = 'recebido';
          } else if (anyInTransit && request.status !== 'enviado') {
            updatedStatus = 'enviado';
          }
          
          if (updatedStatus !== request.status) {
            await supabase
              .from('requests')
              .update({ status: updatedStatus })
              .eq('id', request.id);
            
            return { ...request, status: updatedStatus };
          }
        }
        
        return request;
      }));
      
      setRequests(requestsWithUpdatedStatus2);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleApprove = async (id: string) => {
    if (!profile || !['admin', 'gestor', 'operador-almoxarife'].includes(profile.role)) {
      toast.error('Você não tem permissão para aprovar pedidos');
      return;
    }

    if (window.confirm('Tem certeza que deseja aprovar este pedido?')) {
      try {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'aprovado',
            approved_by: profile.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', id);

        if (error) throw error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'REQUEST_APPROVED',
          tableName: 'requests',
          recordId: id,
          newValues: {
            approved_by: profile.id,
            approved_at: new Date().toISOString(),
            status: 'aprovado'
          }
        });

        fetchRequests();
        toast.success('Pedido aprovado com sucesso!');
      } catch (error) {
        console.error('Error approving request:', error);
        toast.error('Erro ao aprovar pedido');
      }
    }
  };

  const handleReject = async (id: string) => {
    if (!profile || !['admin', 'gestor', 'operador-almoxarife'].includes(profile.role)) {
      toast.error('Você não tem permissão para rejeitar pedidos');
      return;
    }

    const reason = window.prompt('Digite o motivo da rejeição:');
    if (reason === null) return; // Usuário cancelou

    if (reason.trim() === '') {
      toast.error('Motivo da rejeição é obrigatório');
      return;
    }

    try {
      const { error } = await supabase
        .from('requests')
        .update({
          status: 'rejeitado',
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
          rejection_reason: reason.trim()
        })
        .eq('id', id);

      if (error) throw error;

      // Criar log de auditoria
      await createAuditLog({
        action: 'REQUEST_REJECTED',
        tableName: 'requests',
        recordId: id,
        newValues: {
          approved_by: profile.id,
          approved_at: new Date().toISOString(),
          status: 'rejeitado',
          rejection_reason: reason.trim()
        }
      });

      fetchRequests();
      toast.success('Pedido rejeitado com sucesso!');
    } catch (error) {
      console.error('Error rejecting request:', error);
      toast.error('Erro ao rejeitar pedido');
    }
  };

  const handleFinalizeRequest = async (id: string) => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    // Verificar se o usuário pode finalizar este pedido
    const request = requests.find(r => r.id === id);
    if (!request) return;

    const canFinalize = profile.role === 'admin' || 
                       profile.role === 'gestor' ||
                       (profile.role === 'operador-administrativo' && profile.unit_id === request.requesting_unit_id);

    if (!canFinalize) {
      toast.error('Você não tem permissão para finalizar este pedido');
      return;
    }

    if (window.confirm('Confirmar o recebimento final dos itens? Isso irá consumir o orçamento da unidade.')) {
      try {
        // Buscar dados do pedido para consumir orçamento
        const { data: requestData, error: requestFetchError } = await supabase
          .from('requests')
          .select('total_estimated_cost, requesting_unit_id, budget_consumed')
          .eq('id', id)
          .single();

        if (requestFetchError) throw requestFetchError;

        // Verificar se o orçamento já foi consumido
        if (requestData.budget_consumed) {
          toast.error('O orçamento deste pedido já foi consumido anteriormente');
          return;
        }

        // Marcar pedido como aprovado pela unidade e consumir orçamento
        const { error: requestUpdateError } = await supabase
          .from('requests')
          .update({ 
            status: 'aprovado-unidade',
            budget_consumed: true,
            budget_consumption_date: new Date().toISOString()
          })
          .eq('id', id);

        if (requestUpdateError) throw requestUpdateError;

        // Criar transação financeira de despesa
        const { error: transactionError } = await supabase
          .from('financial_transactions')
          .insert({
            type: 'expense',
            amount: requestData.total_estimated_cost,
            description: `Consumo de orçamento - Pedido interno #${id.slice(0, 8)}`,
            unit_id: requestData.requesting_unit_id,
            reference_type: 'request',
            reference_id: id,
            created_by: profile.id
          });

        if (transactionError) throw transactionError;

        // Atualizar orçamento da unidade
        const { error: budgetUpdateError } = await supabase
          .from('unit_budgets')
          .update({
            used_amount: supabase.raw(`used_amount + ${requestData.total_estimated_cost}`),
            available_amount: supabase.raw(`available_amount - ${requestData.total_estimated_cost}`)
          })
          .eq('unit_id', requestData.requesting_unit_id)
          .lte('period_start', getTodayBrazilForInput())
          .gte('period_end', getTodayBrazilForInput());

        if (budgetUpdateError) throw budgetUpdateError;

        // Criar log de auditoria
        await createAuditLog({
          action: 'REQUEST_FINALIZED_BY_UNIT',
          tableName: 'requests',
          recordId: id,
          newValues: {
            status: 'aprovado-unidade',
            budget_consumed: true,
            budget_consumption_date: new Date().toISOString(),
            finalized_by: profile.id
          }
        });

        fetchRequests();
        toast.success('🎉 Pedido finalizado! Orçamento consumido com sucesso.');
      } catch (error) {
        console.error('Error finalizing request:', error);
        toast.error('Erro ao finalizar pedido');
      }
    }
  };

  const handleRequestSaved = () => {
    fetchRequests();
    setModalOpen(false);
    setEditingRequest(null);
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'solicitado': { variant: 'info' as const, label: 'Solicitado' },
      'analisando': { variant: 'warning' as const, label: 'Analisando' },
      'aprovado': { variant: 'success' as const, label: 'Aprovado' },
      'aprovado-pendente': { variant: 'warning' as const, label: 'Aprovado - Compra Pendente' },
      'rejeitado': { variant: 'error' as const, label: 'Rejeitado' },
      'preparando': { variant: 'info' as const, label: 'Preparando' },
      'enviado': { variant: 'success' as const, label: 'Enviado' },
      'recebido': { variant: 'success' as const, label: 'Recebido' },
      'aprovado-unidade': { variant: 'success' as const, label: 'Finalizado' },
      'erro-pedido': { variant: 'error' as const, label: 'Erro no Pedido' },
      'cancelado': { variant: 'default' as const, label: 'Cancelado' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      'baixa': { variant: 'default' as const, label: 'Baixa' },
      'normal': { variant: 'info' as const, label: 'Normal' },
      'alta': { variant: 'warning' as const, label: 'Alta' },
      'urgente': { variant: 'error' as const, label: 'Urgente' },
    };

    const priorityInfo = priorityMap[priority as keyof typeof priorityMap] || { variant: 'default' as const, label: priority };
    return <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>;
  };

  const getVisibilityInfo = () => {
    if (!profile) return '';
    
    switch (profile.role) {
      case 'admin':
        return 'Visualizando: Todos os pedidos do sistema';
      case 'operador-almoxarife':
        return 'Visualizando: Todos os pedidos do sistema';
      case 'gestor':
        return 'Visualizando: Pedidos da sua unidade';
      case 'operador-administrativo':
        return 'Visualizando: Apenas seus pedidos';
      case 'operador-financeiro':
        return 'Visualizando: Pedidos da sua unidade';
      default:
        return '';
    }
  };

  const canApproveReject = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);
  const canCreate = permissions.canCreate;

  // Admin e almoxarife podem editar qualquer pedido (exceto finalizados e cancelados)
  // Outros usuários seguem as permissões padrão
  const canEditAnyRequest = profile?.role && ['admin', 'operador-almoxarife'].includes(profile.role);
  const canEditOwnRequests = permissions.canUpdate;

  const columns = [
    {
      key: 'id',
      title: 'ID',
      render: (value: string) => (
        <span className="font-mono text-xs">{value.slice(0, 8)}</span>
      )
    },
    {
      key: 'requesting_unit',
      title: 'Unidade',
      render: (unit: any) => unit?.name || '-'
    },
    {
      key: 'requester',
      title: 'Solicitante',
      render: (requester: any) => requester?.name || '-'
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'priority',
      title: 'Prioridade',
      render: (value: string) => getPriorityBadge(value)
    },
    {
      key: 'total_estimated_cost',
      title: 'Custo Estimado',
      render: (value: number, record: RequestWithDetails) => (
        <div>
          <span className="font-medium text-primary-600">
            R$ {(value || 0).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          {record.budget_consumed && (
            <div className="text-xs text-green-600 mt-1">✅ Orçamento consumido</div>
          )}
        </div>
      )
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => formatDBDateForDisplay(value)
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: RequestWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setViewingRequest(record);
              setDetailsModalOpen(true);
            }}
          >
            <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
          {(
            // Admin e almoxarife podem editar qualquer pedido não finalizado/cancelado
            (canEditAnyRequest && !['aprovado-unidade', 'cancelado'].includes(record.status)) ||
            // Outros usuários só podem editar pedidos em análise
            (canEditOwnRequests && ['solicitado', 'analisando'].includes(record.status))
          ) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingRequest(record);
                setModalOpen(true);
              }}
            >
              <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
          {canApproveReject && ['solicitado', 'analisando'].includes(record.status) && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApprove(record.id)}
                className="text-green-600 hover:text-green-700"
              >
                <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleReject(record.id)}
                className="text-red-600 hover:text-red-700"
              >
                <XMarkIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </>
          )}
          {record.status === 'recebido' && profile && (
            profile.role === 'admin' || 
            profile.role === 'gestor' ||
            (profile.role === 'operador-administrativo' && profile.unit_id === record.requesting_unit_id)
          ) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleFinalizeRequest(record.id)}
              className="text-blue-600 hover:text-blue-700"
            >
              ✅ Finalizar
            </Button>
          )}
        </div>
      ),
    },
  ];

  const statusCounts = requests.reduce((acc, request) => {
    acc[request.status] = (acc[request.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!permissions.canAccessRequests) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar pedidos internos.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Pedidos Internos</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie pedidos entre unidades e centros de distribuição
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
              setEditingRequest(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Pedido
          </Button>
        )}
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex items-center mb-4">
          <FunnelIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <option value="solicitado">Solicitado</option>
              <option value="analisando">Analisando</option>
              <option value="aprovado">Aprovado</option>
              <option value="aprovado-pendente">Aprovado - Compra Pendente</option>
              <option value="rejeitado">Rejeitado</option>
              <option value="preparando">Preparando</option>
              <option value="enviado">Enviado</option>
              <option value="recebido">Recebido</option>
              <option value="aprovado-unidade">Finalizado</option>
              <option value="erro-pedido">Erro no Pedido</option>
              <option value="cancelado">Cancelado</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="filter_priority" className="block text-sm font-medium text-gray-700 mb-1">
              Prioridade
            </label>
            <select
              id="filter_priority"
              value={filters.priority}
              onChange={(e) => setFilters(prev => ({ ...prev, priority: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todas as prioridades</option>
              <option value="baixa">Baixa</option>
              <option value="normal">Normal</option>
              <option value="alta">Alta</option>
              <option value="urgente">Urgente</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="filter_unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade Solicitante
            </label>
            <select
              id="filter_unit"
              value={filters.requesting_unit_id}
              onChange={(e) => setFilters(prev => ({ ...prev, requesting_unit_id: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todas as unidades</option>
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
              onClick={() => setFilters({ status: '', priority: '', requesting_unit_id: '' })}
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      {/* Estatísticas */}
      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-warning-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Pendentes</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['solicitado'] || 0) + (statusCounts['analisando'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-success-100 rounded-full flex items-center justify-center">
                <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-success-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Aprovados</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['aprovado'] || 0) + (statusCounts['aprovado-pendente'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-info-100 rounded-full flex items-center justify-center">
                <TruckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-info-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Em Trânsito</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['enviado'] || 0) + (statusCounts['recebido'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-xs sm:text-sm">#</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">{requests.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Informação sobre o fluxo */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 mb-2">🔄 Fluxo de Pedidos Internos</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>1. Solicitado:</strong> Pedido criado, aguardando análise</p>
              <p><strong>2. Aprovado:</strong> Pedido aprovado, pronto para envio</p>
              <p><strong>3. Enviado:</strong> Itens em rota para a unidade</p>
              <p><strong>4. Recebido:</strong> Itens chegaram na unidade</p>
              <p><strong>5. Finalizado:</strong> Confirmação final e consumo do orçamento</p>
            </div>
          </div>
        </div>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={requests}
          loading={loading}
          emptyMessage="Nenhum pedido encontrado"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingRequest(null);
        }}
        title={editingRequest ? 'Editar Pedido' : 'Novo Pedido Interno'}
        size="xl"
      >
        <RequestForm
          request={editingRequest}
          onSave={handleRequestSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingRequest(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setViewingRequest(null);
        }}
        title="Detalhes do Pedido"
        size="lg"
      >
        {viewingRequest && (
          <RequestDetails
            request={viewingRequest}
            onClose={() => {
              setDetailsModalOpen(false);
              setViewingRequest(null);
            }}
            onApprove={handleApprove}
            onReject={handleReject}
          />
        )}
      </Modal>
    </div>
  );
};

export default Requests;