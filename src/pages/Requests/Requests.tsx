import React, { useEffect, useState } from 'react';
import { 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  CheckIcon, 
  XMarkIcon,
  ClockIcon,
  TruckIcon,
  ExclamationTriangleIcon
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
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
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
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, []);

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
      if (profile?.role === 'operador-administrativo') {
        // Op. Administrativo: apenas seus próprios pedidos
        query = query.eq('requester_id', profile.id);
      } else if (profile?.role === 'operador-financeiro' && profile.unit_id) {
        // Op. Financeiro: pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      }
      // Admin e Op. Almoxarife podem ver todos (sem filtro adicional)

      const { data, error } = await query;

      if (error) throw error;
      
      // Atualizar status dos pedidos baseado em itens em rota
      const requestsWithUpdatedStatus = await Promise.all((data || []).map(async (request) => {
        // Verificar se há itens deste pedido em rota
        const { data: emRotaItems } = await supabase
          .from('em_rota')
          .select('status')
          .eq('request_id', request.id);
        
        if (emRotaItems && emRotaItems.length > 0) {
          const allDelivered = emRotaItems.every(item => item.status === 'entregue');
          const anyInTransit = emRotaItems.some(item => item.status === 'em_transito');
          
          let updatedStatus = request.status;
          
          if (allDelivered && request.status === 'enviado') {
            updatedStatus = 'recebido';
            // Atualizar no banco de dados
            await supabase
              .from('requests')
              .update({ status: 'recebido' })
              .eq('id', request.id);
          } else if (anyInTransit && request.status !== 'enviado') {
            updatedStatus = 'enviado';
            // Atualizar no banco de dados
            await supabase
              .from('requests')
              .update({ status: 'enviado' })
              .eq('id', request.id);
          }
          
          return { ...request, status: updatedStatus };
        }
        
        return request;
      }));
      
      setRequests(requestsWithUpdatedStatus);
    } catch (error) {
      console.error('Error fetching requests:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  const handleApproveRequest = async (requestId: string) => {
    if (!permissions.canApproveRequests) {
      toast.error('Você não tem permissão para aprovar pedidos');
      return;
    }

    if (window.confirm('Tem certeza que deseja aprovar este pedido?')) {
      try {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'aprovado',
            approved_by: profile?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (error) throw error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'REQUEST_APPROVED',
          tableName: 'requests',
          recordId: requestId,
          newValues: {
            status: 'aprovado',
            approved_by: profile?.id,
            approved_at: new Date().toISOString()
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

  const handleRejectRequest = async (requestId: string) => {
    if (!permissions.canApproveRequests) {
      toast.error('Você não tem permissão para rejeitar pedidos');
      return;
    }

    const reason = window.prompt('Motivo da rejeição:');
    if (reason) {
      try {
        const { error } = await supabase
          .from('requests')
          .update({
            status: 'rejeitado',
            rejection_reason: reason,
            approved_by: profile?.id,
            approved_at: new Date().toISOString()
          })
          .eq('id', requestId);

        if (error) throw error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'REQUEST_REJECTED',
          tableName: 'requests',
          recordId: requestId,
          newValues: {
            status: 'rejeitado',
            rejection_reason: reason,
            approved_by: profile?.id,
            approved_at: new Date().toISOString()
          }
        });

        fetchRequests();
        toast.success('Pedido rejeitado');
      } catch (error) {
        console.error('Error rejecting request:', error);
        toast.error('Erro ao rejeitar pedido');
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
      'rejeitado': { variant: 'error' as const, label: 'Rejeitado' },
      'preparando': { variant: 'info' as const, label: 'Preparando' },
      'enviado': { variant: 'success' as const, label: 'Enviado' },
      'recebido': { variant: 'success' as const, label: 'Recebido' },
      'aprovado-unidade': { variant: 'success' as const, label: 'Aprovado Unidade' },
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

  const canCreateRequest = profile?.role && ['admin', 'gestor', 'operador-administrativo', 'operador-financeiro', 'operador-almoxarife'].includes(profile.role);
  const canEditRequest = (request: any) => {
    if (!profile) return false;
    
    // Não pode editar se estiver finalizado ou cancelado
    if (['aprovado-unidade', 'cancelado'].includes(request.status)) return false;
    
    // Admins e gestores podem editar qualquer pedido
    if (['admin', 'gestor'].includes(profile.role)) return true;
    
    // Operador almoxarife pode editar status
    if (profile.role === 'operador-almoxarife') return true;
    
    // Operador financeiro pode editar quando aprovado
    if (profile.role === 'operador-financeiro' && request.status === 'aprovado') return true;
    
    // Operador administrativo pode editar apenas seus próprios pedidos em status inicial
    if (profile.role === 'operador-administrativo' && 
        request.requester_id === profile.id && 
        ['solicitado', 'analisando'].includes(request.status)) {
      return true;
    }
    
    return false;
  };

  const getVisibilityInfo = () => {
    if (!profile) return '';
    
    switch (profile.role) {
      case 'admin':
        return 'Visualizando: Todos os pedidos do sistema';
      case 'gestor':
        return 'Visualizando: Pedidos da sua unidade';
      case 'operador-administrativo':
        return 'Visualizando: Apenas seus pedidos';
      case 'operador-almoxarife':
        return 'Visualizando: Todos os pedidos do sistema';
      case 'operador-financeiro':
        return 'Visualizando: Pedidos da sua unidade';
      default:
        return '';
    }
  };

  const columns = [
    {
      key: 'id',
      title: 'ID',
      render: (value: string) => (
        <span className="font-mono text-xs sm:text-sm">{value.slice(0, 8)}...</span>
      )
    },
    {
      key: 'requesting_unit',
      title: 'Unidade Solicitante',
      render: (unit: any) => (
        <span className="text-xs sm:text-sm">{unit?.name || '-'}</span>
      )
    },
    {
      key: 'cd_unit',
      title: 'CD Responsável',
      render: (unit: any) => (
        <span className="text-xs sm:text-sm">{unit?.name || '-'}</span>
      )
    },
    {
      key: 'requester',
      title: 'Solicitante',
      render: (requester: any) => (
        <span className="text-xs sm:text-sm">{requester?.name || '-'}</span>
      )
    },
    {
      key: 'priority',
      title: 'Prioridade',
      render: (value: string) => getPriorityBadge(value)
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => (
        <span className="text-xs sm:text-sm">
          {new Date(value).toLocaleDateString('pt-BR')}
        </span>
      )
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
          {canEditRequest(record) && (
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
          {permissions.canApproveRequests && ['solicitado', 'analisando'].includes(record.status) && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleApproveRequest(record.id)}
                className="text-green-600 hover:text-green-700"
              >
                <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => handleRejectRequest(record.id)}
                className="text-red-600 hover:text-red-700"
              >
                <XMarkIcon className="w-3 h-3 sm:w-4 sm:h-4" />
              </Button>
            </>
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
          <p className="text-gray-500">Você não tem permissão para acessar o módulo de pedidos.</p>
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
            Solicitações de itens entre unidades e centros de distribuição
          </p>
          {getVisibilityInfo() && (
            <p className="mt-1 text-xs text-blue-600 font-medium">
              {getVisibilityInfo()}
            </p>
          )}
        </div>
        {canCreateRequest && (
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

      {/* Informações sobre o módulo */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <ExclamationTriangleIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 mb-2">📋 Sistema de Pedidos Aprimorado</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>1. Filtro Inteligente:</strong> Apenas itens com estoque no CD + flag "Exibir empresa"</p>
              <p><strong>2. Integração Financeira:</strong> Status "Aprovado" consome orçamento da unidade</p>
              <p><strong>3. Controle de Erros:</strong> Status "Erro no Pedido" permite marcar itens com problema</p>
              <p><strong>4. Finalização:</strong> "Aprovado pela Unidade" confirma recebimento completo</p>
              <p><strong>5. Cancelamento:</strong> Pedidos cancelados não podem mais ser editados</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-info-100 rounded-full flex items-center justify-center">
                <ClockIcon className="w-4 h-4 sm:w-5 sm:h-5 text-info-600" />
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
                {statusCounts['aprovado'] || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <TruckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-warning-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Em Processo</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['preparando'] || 0) + (statusCounts['enviado'] || 0) + (statusCounts['recebido'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-error-100 rounded-full flex items-center justify-center">
                <XMarkIcon className="w-4 h-4 sm:w-5 sm:h-5 text-error-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Com Problema</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['rejeitado'] || 0) + (statusCounts['erro-pedido'] || 0) + (statusCounts['cancelado'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-xs sm:text-sm">✓</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Finalizados</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts['aprovado-unidade'] || 0}
              </p>
            </div>
          </div>
        </Card>
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
            onApprove={permissions.canApproveRequests ? handleApproveRequest : undefined}
            onReject={permissions.canApproveRequests ? handleRejectRequest : undefined}
          />
        )}
      </Modal>
    </div>
  );
};

export default Requests;