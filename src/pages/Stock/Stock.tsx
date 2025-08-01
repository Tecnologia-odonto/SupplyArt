import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, FunnelIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { Item, Unit } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import StockForm from './StockForm';
import toast from 'react-hot-toast';

interface StockWithDetails {
  id: string;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  location: string | null;
  item: {
    code: string;
    name: string;
    category: string;
    unit_measure: string;
  };
  unit: {
    name: string;
  };
}

const Stock: React.FC = () => {
  const [stock, setStock] = useState<StockWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [filters, setFilters] = useState({
    unit_id: '',
    item_id: '',
    status: ''
  });
  const [units, setUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchFilterData();
    fetchStock();
  }, []);

  useEffect(() => {
    fetchStock();
  }, [filters]);

  const fetchFilterData = async () => {
    try {
      const [unitsResult, itemsResult] = await Promise.all([
        supabase.from('units').select('id, name').order('name'),
        supabase.from('items').select('id, name, code').order('name')
      ]);

      if (unitsResult.error) throw unitsResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setUnits(unitsResult.data || []);
      setItems(itemsResult.data || []);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const fetchStock = async () => {
    try {
      let query = supabase
        .from('stock')
        .select(`
          *,
          item:items(code, name, category, unit_measure),
          unit:units(name)
        `)
        .order('quantity', { ascending: true });

      // Aplicar filtro de unidade baseado no role
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        // Operador administrativo: apenas sua unidade (não CD)
        query = query.eq('unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: apenas sua unidade (não CD)
        query = query.eq('unit_id', profile.unit_id);
      }
      // Admin pode ver todos, Op. Almoxarife vê todas as unidades (não CDs)
      
      // Para todos os usuários: filtrar apenas unidades (não CDs)
      // Buscar IDs das unidades que NÃO são CD
      const { data: nonCdUnits } = await supabase
        .from('units')
        .select('id')
        .eq('is_cd', false);
      
      if (nonCdUnits && nonCdUnits.length > 0) {
        const unitIds = nonCdUnits.map(unit => unit.id);
        query = query.in('unit_id', unitIds);
      }
      // Aplicar filtros
      if (filters.unit_id) {
        query = query.eq('unit_id', filters.unit_id);
      }
      if (filters.item_id) {
        query = query.eq('item_id', filters.item_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      
      let filteredData = data || [];
      
      // Filtro de status (aplicado no frontend)
      if (filters.status) {
        filteredData = filteredData.filter(item => {
          const status = getStockStatus(item.quantity, item.min_quantity);
          return status === filters.status;
        });
      }
      
      setStock(filteredData);
    } catch (error) {
      console.error('Error fetching stock:', error);
      toast.error('Erro ao carregar estoque');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    // Verificar se o usuário tem permissão para excluir (apenas admin e gestor)
    if (!profile || !['admin', 'gestor'].includes(profile.role)) {
      toast.error('Você não tem permissão para excluir registros de estoque');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este registro de estoque?')) {
      try {
        const { error } = await supabase
          .from('stock')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setStock(stock.filter(item => item.id !== id));
        toast.success('Registro de estoque excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting stock:', error);
        toast.error('Erro ao excluir registro de estoque');
      }
    }
  };

  const getStockStatus = (quantity: number, minQuantity: number | null) => {
    if (!minQuantity) return 'normal';
    if (quantity === 0) return 'empty';
    if (quantity <= minQuantity) return 'low';
    return 'normal';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'empty':
        return <Badge variant="error">Vazio</Badge>;
      case 'low':
        return <Badge variant="warning">Baixo</Badge>;
      default:
        return <Badge variant="success">Normal</Badge>;
    }
  };

  const handleStockSaved = () => {
    fetchStock();
    setModalOpen(false);
    setEditingStock(null);
  };

  const canDelete = profile?.role && ['admin', 'gestor'].includes(profile.role);
  const canEdit = permissions.canUpdate;

  const columns = [
    {
      key: 'item',
      title: 'Item',
      render: (item: any) => (
        <div>
          <div className="font-medium">{item.name}</div>
          <div className="text-sm text-gray-500">{item.code}</div>
          {item.category && (
            <div className="text-xs text-blue-600 mt-1">{item.category}</div>
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
      render: (value: number, record: StockWithDetails) => (
        <div className="flex items-center space-x-2">
          <span className="font-medium">{value}</span>
          <span className="text-sm text-gray-500">{record.item.unit_measure}</span>
          {value === 0 && (
            <Badge variant="error" size="sm">Sem Estoque</Badge>
          )}
        </div>
      )
    },
    {
      key: 'min_quantity',
      title: 'Mín/Máx',
      render: (minQty: number | null, record: StockWithDetails) => (
        <span className="text-sm text-gray-600">
          {minQty || 0} / {record.max_quantity || '-'}
        </span>
      )
    },
    {
      key: 'location',
      title: 'Localização',
      render: (value: string) => value || '-'
    },
    {
      key: 'status',
      title: 'Status',
      render: (_: any, record: StockWithDetails) => {
        const status = getStockStatus(record.quantity, record.min_quantity);
        return getStatusBadge(status);
      }
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: StockWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingStock(record);
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

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Estoque</h1>
          <p className="mt-1 text-sm text-gray-600">
            Controle de estoque por unidade
            {profile?.role === 'operador-administrativo' && ' - Sua unidade'}
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => {
              setEditingStock(null);
              setModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Ajustar Estoque
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
            <label htmlFor="filter_unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade
            </label>
            <select
              id="filter_unit"
              value={filters.unit_id}
              onChange={(e) => setFilters(prev => ({ ...prev, unit_id: e.target.value }))}
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
          
          <div>
            <label htmlFor="filter_item" className="block text-sm font-medium text-gray-700 mb-1">
              Item
            </label>
            <select
              id="filter_item"
              value={filters.item_id}
              onChange={(e) => setFilters(prev => ({ ...prev, item_id: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todos os itens</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
          </div>
          
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
              <option value="normal">Normal</option>
              <option value="low">Estoque Baixo</option>
              <option value="empty">Sem Estoque</option>
            </select>
          </div>
          
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setFilters({ unit_id: '', item_id: '', status: '' })}
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-xs sm:text-sm">✓</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Itens Normais</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {stock.filter(s => getStockStatus(s.quantity, s.min_quantity) === 'normal').length}
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
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Estoque Baixo</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {stock.filter(s => getStockStatus(s.quantity, s.min_quantity) === 'low').length}
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
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Sem Estoque</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {stock.filter(s => getStockStatus(s.quantity, s.min_quantity) === 'empty').length}
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
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total de Itens</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">{stock.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={stock}
          loading={loading}
          emptyMessage="Nenhum item em estoque"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingStock(null);
        }}
        title={editingStock ? 'Editar Estoque' : 'Ajustar Estoque'}
        size="lg"
      >
        <StockForm
          stock={editingStock}
          onSave={handleStockSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingStock(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Stock;