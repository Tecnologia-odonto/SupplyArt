import React, { useEffect, useState } from 'react';
import { ArrowsRightLeftIcon, PlusIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import MovementForm from './MovementForm';
import toast from 'react-hot-toast';

interface MovementWithDetails {
  id: string;
  quantity: number;
  type: 'transfer' | 'adjustment' | 'purchase';
  reference: string | null;
  notes: string | null;
  created_at: string;
  item: {
    code: string;
    name: string;
    unit_measure: string;
  };
  from_unit: {
    name: string;
  };
  to_unit: {
    name: string;
  };
  created_by_profile: {
    name: string;
  };
}

const Movements: React.FC = () => {
  const [movements, setMovements] = useState<MovementWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const permissions = usePermissions();

  useEffect(() => {
    fetchMovements();
  }, []);

  const fetchMovements = async () => {
    try {
      const { data, error } = await supabase
        .from('movements')
        .select(`
          *,
          item:items(code, name, unit_measure),
          from_unit:units!movements_from_unit_id_fkey(name),
          to_unit:units!movements_to_unit_id_fkey(name),
          created_by_profile:profiles!movements_created_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setMovements(data || []);
    } catch (error) {
      console.error('Error fetching movements:', error);
      toast.error('Erro ao carregar movimentações');
    } finally {
      setLoading(false);
    }
  };

  const handleMovementSaved = () => {
    fetchMovements();
    setModalOpen(false);
  };

  const getTypeBadge = (type: string) => {
    const typeMap = {
      transfer: { variant: 'info' as const, label: 'Transferência' },
      adjustment: { variant: 'warning' as const, label: 'Ajuste' },
      purchase: { variant: 'success' as const, label: 'Compra' },
    };

    const typeInfo = typeMap[type as keyof typeof typeMap] || { variant: 'default' as const, label: type };
    return <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>;
  };

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
      key: 'type',
      title: 'Tipo',
      render: (value: string) => getTypeBadge(value)
    },
    {
      key: 'quantity',
      title: 'Quantidade',
      render: (value: number, record: MovementWithDetails) => (
        <div className="flex items-center space-x-2">
          <span className="font-medium">{value}</span>
          <span className="text-sm text-gray-500">{record.item.unit_measure}</span>
        </div>
      )
    },
    {
      key: 'from_unit',
      title: 'De',
      render: (unit: any) => unit.name
    },
    {
      key: 'to_unit',
      title: 'Para',
      render: (unit: any, record: MovementWithDetails) => {
        // Para ajustes, mostrar apenas a unidade
        if (record.type === 'adjustment') {
          return <span className="text-gray-500 italic">Ajuste</span>;
        }
        return unit.name;
      }
    },
    {
      key: 'reference',
      title: 'Referência',
      render: (value: string) => value || '-'
    },
    {
      key: 'created_by_profile',
      title: 'Criado por',
      render: (profile: any) => profile?.name || 'Sistema'
    },
    {
      key: 'created_at',
      title: 'Data',
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR')
    },
  ];

  if (!permissions.canAccessMovements) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar as movimentações.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Movimentações</h1>
          <p className="mt-1 text-sm text-gray-600">
            Histórico de movimentações de estoque entre unidades
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => setModalOpen(true)}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Nova Movimentação
          </Button>
        )}
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h3 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Tipos de Movimentação</h3>
        <div className="text-xs text-blue-700 space-y-1">
          <p><strong>Transferência:</strong> Movimentação entre unidades diferentes</p>
          <p><strong>Ajuste:</strong> Correção de quantidade no estoque</p>
          <p><strong>Compra:</strong> Criada automaticamente quando pedidos são finalizados</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                <ArrowsRightLeftIcon className="w-5 h-5 text-info-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Transferências</p>
              <p className="text-lg font-semibold text-gray-900">
                {movements.filter(m => m.type === 'transfer').length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-sm">A</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Ajustes</p>
              <p className="text-lg font-semibold text-gray-900">
                {movements.filter(m => m.type === 'adjustment').length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-sm">C</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Compras</p>
              <p className="text-lg font-semibold text-gray-900">
                {movements.filter(m => m.type === 'purchase').length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">#</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">{movements.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={movements}
          loading={loading}
          emptyMessage="Nenhuma movimentação encontrada"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title="Nova Movimentação"
        size="lg"
      >
        <MovementForm
          onSave={handleMovementSaved}
          onCancel={() => setModalOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default Movements;