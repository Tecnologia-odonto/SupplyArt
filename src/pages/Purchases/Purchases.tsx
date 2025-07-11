import React, { useEffect, useState } from 'react';
import { PlusIcon, EyeIcon, PencilIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import PurchaseForm from './PurchaseForm';
import PurchaseDetails from './PurchaseDetails';
import toast from 'react-hot-toast';

interface PurchaseWithDetails {
  id: string;
  status: string;
  total_value: number | null;
  notes: string | null;
  created_at: string;
  requester_id: string;
  unit: {
    name: string;
  };
  requester: {
    name: string;
  };
  supplier: {
    name: string;
  } | null;
}

const Purchases: React.FC = () => {
  const [purchases, setPurchases] = useState<PurchaseWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingPurchase, setEditingPurchase] = useState<any>(null);
  const [viewingPurchase, setViewingPurchase] = useState<any>(null);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchPurchases();
  }, []);

  const fetchPurchases = async () => {
    try {
      let query = supabase
        .from('purchases')
        .select(`
          *,
          unit:units(name),
          requester:profiles(name),
          supplier:suppliers(name)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros baseados no role do usuário
      if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: apenas da sua unidade
        query = query.eq('unit_id', profile.unit_id);
      } else if (profile?.role === 'operador-administrativo') {
        // Op. Administrativo: apenas seus próprios pedidos
        query = query.eq('requester_id', profile.id);
      } else if (profile?.role === 'operador-financeiro' && profile.unit_id) {
        // Op. Financeiro: todos da sua unidade
        query = query.eq('unit_id', profile.unit_id);
      }
      // Admin e Op. Almoxarife podem ver todos (sem filtro adicional)

      const { data, error } = await query;

      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Erro ao carregar compras');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pedido-realizado': { variant: 'info' as const, label: 'Pedido Realizado' },
      'em-cotacao': { variant: 'warning' as const, label: 'Em Cotação' },
      'comprado-aguardando': { variant: 'info' as const, label: 'Comprado - Aguardando' },
      'chegou-cd': { variant: 'success' as const, label: 'Chegou ao CD' },
      'enviado': { variant: 'success' as const, label: 'Enviado' },
      'erro-pedido': { variant: 'error' as const, label: 'Erro no Pedido' },
      'finalizado': { variant: 'success' as const, label: 'Finalizado' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const handlePurchaseSaved = () => {
    fetchPurchases();
    setModalOpen(false);
    setEditingPurchase(null);
  };

  const canCreatePurchase = profile?.role && ['admin', 'gestor', 'operador-administrativo'].includes(profile.role);
  const canEditPurchase = (purchase: any) => {
    if (!profile) return false;
    
    // Admins e gestores podem editar qualquer compra
    if (['admin', 'gestor'].includes(profile.role)) return true;
    
    // Operador financeiro pode editar informações financeiras
    if (profile.role === 'operador-financeiro') return true;
    
    // Operador almoxarife pode editar status
    if (profile.role === 'operador-almoxarife') return true;
    
    // Operador administrativo pode editar apenas suas próprias compras em status inicial
    if (profile.role === 'operador-administrativo' && 
        purchase.requester_id === profile.id && 
        purchase.status === 'pedido-realizado') {
      return true;
    }
    
    return false;
  };

  const getVisibilityInfo = () => {
    if (!profile) return '';
    
    switch (profile.role) {
      case 'admin':
        return 'Visualizando: Todas as compras do sistema';
      case 'gestor':
        return 'Visualizando: Todas as compras da sua unidade';
      case 'operador-administrativo':
        return 'Visualizando: Apenas seus pedidos de compra';
      case 'operador-almoxarife':
        return 'Visualizando: Todas as compras do sistema';
      case 'operador-financeiro':
        return 'Visualizando: Todas as compras da sua unidade';
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
      key: 'unit',
      title: 'Unidade',
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
      key: 'supplier',
      title: 'Fornecedor',
      render: (supplier: any) => (
        <span className="text-xs sm:text-sm">
          {(supplier && typeof supplier === 'object' && supplier.name) ? supplier.name : '-'}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'total_value',
      title: 'Valor Total',
      render: (value: number | null) => (
        <span className="text-xs sm:text-sm">
          {value ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'}
        </span>
      )
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
      render: (_: any, record: PurchaseWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setViewingPurchase(record);
              setDetailsModalOpen(true);
            }}
          >
            <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
          {canEditPurchase(record) && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingPurchase(record);
                setModalOpen(true);
              }}
            >
              <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const statusCounts = purchases.reduce((acc, purchase) => {
    acc[purchase.status] = (acc[purchase.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Compras</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie pedidos de compra e acompanhe o fluxo de aprovação
          </p>
          {getVisibilityInfo() && (
            <p className="mt-1 text-xs text-blue-600 font-medium">
              {getVisibilityInfo()}
            </p>
          )}
        </div>
        {canCreatePurchase && (
          <Button
            onClick={() => {
              setEditingPurchase(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Pedido
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-xs sm:text-sm">P</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Pendentes</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['pedido-realizado'] || 0) + (statusCounts['em-cotacao'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-xs sm:text-sm">C</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Em Processo</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {(statusCounts['comprado-aguardando'] || 0) + (statusCounts['chegou-cd'] || 0) + (statusCounts['enviado'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-xs sm:text-sm">✓</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Finalizadas</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts['finalizado'] || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-error-100 rounded-full flex items-center justify-center">
                <span className="text-error-600 font-semibold text-xs sm:text-sm">!</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Com Erro</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts['erro-pedido'] || 0}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={purchases}
          loading={loading}
          emptyMessage="Nenhuma compra encontrada"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingPurchase(null);
        }}
        title={editingPurchase ? 'Editar Compra' : 'Novo Pedido de Compra'}
        size="xl"
      >
        <PurchaseForm
          purchase={editingPurchase}
          onSave={handlePurchaseSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingPurchase(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setViewingPurchase(null);
        }}
        title="Detalhes da Compra"
        size="lg"
      >
        {viewingPurchase && (
          <PurchaseDetails
            purchase={viewingPurchase}
            onClose={() => {
              setDetailsModalOpen(false);
              setViewingPurchase(null);
            }}
          />
        )}
      </Modal>
    </div>
  );
};

export default Purchases;