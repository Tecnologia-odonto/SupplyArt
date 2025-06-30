import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, EyeIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import InventoryForm from './InventoryForm';
import InventoryItemsList from './InventoryItemsList';
import toast from 'react-hot-toast';

interface InventoryWithDetails {
  id: string;
  quantity: number;
  location: string;
  status: 'available' | 'reserved' | 'damaged' | 'expired';
  notes: string | null;
  description: string | null;
  item: {
    code: string;
    name: string;
    unit_measure: string;
    has_lifecycle: boolean;
  };
  unit: {
    name: string;
  };
}

const Inventory: React.FC = () => {
  const [inventory, setInventory] = useState<InventoryWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingInventory, setEditingInventory] = useState<any>(null);
  const [viewingInventory, setViewingInventory] = useState<any>(null);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchInventory();
  }, []);

  const fetchInventory = async () => {
    try {
      let query = supabase
        .from('inventory')
        .select(`
          *,
          item:items(code, name, unit_measure, has_lifecycle),
          unit:units(name)
        `)
        .order('created_at', { ascending: false });

      // Se for operador administrativo, filtrar apenas sua unidade
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        query = query.eq('unit_id', profile.unit_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setInventory(data || []);
    } catch (error) {
      console.error('Error fetching inventory:', error);
      toast.error('Erro ao carregar inventário');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Verificar se o usuário tem permissão para excluir (apenas admin e gestor)
    if (!profile || !['admin', 'gestor'].includes(profile.role)) {
      toast.error('Você não tem permissão para excluir registros de inventário');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este registro de inventário?')) {
      try {
        const { error } = await supabase
          .from('inventory')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setInventory(inventory.filter(item => item.id !== id));
        toast.success('Registro de inventário excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting inventory:', error);
        toast.error('Erro ao excluir registro de inventário');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'available':
        return <Badge variant="success">Disponível</Badge>;
      case 'reserved':
        return <Badge variant="info">Reservado</Badge>;
      case 'damaged':
        return <Badge variant="warning">Danificado</Badge>;
      case 'expired':
        return <Badge variant="error">Vencido</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const handleInventorySaved = () => {
    fetchInventory();
    setModalOpen(false);
    setEditingInventory(null);
  };

  const canDelete = profile?.role && ['admin', 'gestor'].includes(profile.role);

  const columns = [
    {
      key: 'item',
      title: 'Item',
      render: (item: any) => (
        <div className="flex items-center space-x-2">
          <div>
            <div className="font-medium">{item.name}</div>
            <div className="text-sm text-gray-500">{item.code}</div>
          </div>
          {item.has_lifecycle && (
            <Badge variant="info" size="sm">Vida Útil</Badge>
          )}
        </div>
      )
    },
    {
      key: 'unit',
      title: 'Unidade',
      render: (unit: any) => unit.name
    },
    {
      key: 'quantity',
      title: 'Quantidade',
      render: (value: number, record: InventoryWithDetails) => (
        <div className="flex items-center space-x-2">
          <span className="font-medium">{value}</span>
          <span className="text-sm text-gray-500">{record.item.unit_measure}</span>
          {record.item.has_lifecycle && value === 1 && (
            <Badge variant="info" size="sm">Individual</Badge>
          )}
        </div>
      )
    },
    {
      key: 'location',
      title: 'Localização',
    },
    {
      key: 'description',
      title: 'Descrição',
      render: (value: string) => (
        <span className="text-sm" title={value}>
          {value ? (value.length > 30 ? `${value.substring(0, 30)}...` : value) : '-'}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'notes',
      title: 'Observações',
      render: (value: string) => (
        <span className="text-sm" title={value}>
          {value ? (value.length > 20 ? `${value.substring(0, 20)}...` : value) : '-'}
        </span>
      )
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: InventoryWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
          {record.item.has_lifecycle && (
            <Button
              size="sm"
              variant="ghost"
              onClick={() => {
                setViewingInventory(record);
                setDetailsModalOpen(true);
              }}
              title="Ver controle individual"
            >
              <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
          {permissions.canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingInventory(record);
                setModalOpen(true);
              }}
            >
              <PencilIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(record.id)}
            >
              <TrashIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  const statusCounts = inventory.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const lifecycleCount = inventory.filter(item => item.item.has_lifecycle).length;

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Inventário</h1>
          <p className="mt-1 text-sm text-gray-600">
            Controle detalhado do inventário por localização
            {profile?.role === 'operador-administrativo' && ' - Sua unidade'}
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => {
              setEditingInventory(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Registro
          </Button>
        )}
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-5 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-xs sm:text-sm">✓</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Disponível</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts.available || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-xs sm:text-sm">R</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Reservado</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts.reserved || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-xs sm:text-sm">!</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Danificado</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts.damaged || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-error-100 rounded-full flex items-center justify-center">
                <span className="text-error-600 font-semibold text-xs sm:text-sm">×</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Vencido</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {statusCounts.expired || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-xs sm:text-sm">⚙</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Vida Útil</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {lifecycleCount}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={inventory}
          loading={loading}
          emptyMessage="Nenhum registro de inventário encontrado"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingInventory(null);
        }}
        title={editingInventory ? 'Editar Registro de Inventário' : 'Novo Registro de Inventário'}
        size="lg"
      >
        <InventoryForm
          inventory={editingInventory}
          onSave={handleInventorySaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingInventory(null);
          }}
        />
      </Modal>

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setViewingInventory(null);
        }}
        title="Controle Individual de Itens"
        size="xl"
      >
        {viewingInventory && (
          <InventoryItemsList
            inventoryId={viewingInventory.id}
            itemName={viewingInventory.item.name}
            hasLifecycle={viewingInventory.item.has_lifecycle}
          />
        )}
      </Modal>
    </div>
  );
};

export default Inventory;