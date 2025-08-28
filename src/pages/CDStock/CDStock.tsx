import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, FunnelIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { Item, Unit } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import CDStockForm from './CDStockForm';
import toast from 'react-hot-toast';

interface CDStockWithDetails {
  id: string;
  quantity: number;
  min_quantity: number | null;
  max_quantity: number | null;
  location: string | null;
  unit_price: number;
  last_price_update: string;
  item: {
    code: string;
    name: string;
    category: string;
    unit_measure: string;
  };
  cd_unit: {
    name: string;
  };
}

const CDStock: React.FC = () => {
  const [cdStock, setCdStock] = useState<CDStockWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<any>(null);
  const [filters, setFilters] = useState({
    cd_unit_id: '',
    item_id: '',
    status: ''
  });
  const [cdUnits, setCdUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchFilterData();
    fetchCDStock();
  }, []);

  useEffect(() => {
    fetchCDStock();
  }, [filters]);

  const fetchFilterData = async () => {
    try {
      const [cdUnitsResult, itemsResult] = await Promise.all([
        supabase.from('units').select('id, name').eq('is_cd', true).order('name'),
        supabase.from('items').select('id, name, code').order('name')
      ]);

      if (cdUnitsResult.error) throw cdUnitsResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setCdUnits(cdUnitsResult.data || []);
      setItems(itemsResult.data || []);
    } catch (error) {
      console.error('Error fetching filter data:', error);
    }
  };

  const fetchCDStock = async () => {
    try {
      let query = supabase
        .from('cd_stock')
        .select(`
          *,
          item:items(code, name, category, unit_measure),
          cd_unit:units!cd_stock_cd_unit_id_fkey(name)
        `)
        .order('quantity', { ascending: true });

      // Se for operador almoxarife, filtrar apenas pelo CD vinculado
      if (profile?.role === 'operador-almoxarife' && profile.unit_id) {
        query = query.eq('cd_unit_id', profile.unit_id);
      }

      // Aplicar filtros
      if (filters.cd_unit_id) {
        query = query.eq('cd_unit_id', filters.cd_unit_id);
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
      
      setCdStock(filteredData);
    } catch (error) {
      console.error('Error fetching CD stock:', error);
      toast.error('Erro ao carregar estoque do CD');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile || !['admin', 'operador-almoxarife'].includes(profile.role)) {
      toast.error('Você não tem permissão para excluir registros de estoque do CD');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este registro de estoque do CD?')) {
      try {
        const { error } = await supabase
          .from('cd_stock')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setCdStock(cdStock.filter(item => item.id !== id));
        toast.success('Registro de estoque do CD excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting CD stock:', error);
        toast.error('Erro ao excluir registro de estoque do CD');
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
    fetchCDStock();
    setModalOpen(false);
    setEditingStock(null);
  };

  // Verificar se o usuário tem acesso ao estoque CD
  if (!profile || !['admin', 'operador-almoxarife'].includes(profile.role)) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Apenas Administradores e Operadores Almoxarife podem acessar o estoque do CD.</p>
        </div>
      </div>
    );
  }

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
      key: 'cd_unit',
      title: 'Centro de Distribuição',
      render: (unit: any) => (
        <div className="flex items-center">
          <BuildingOffice2Icon className="w-4 h-4 mr-2 text-blue-600" />
          {unit.name}
        </div>
      )
    },
    {
      key: 'quantity',
      title: 'Quantidade',
      render: (value: number, record: CDStockWithDetails) => (
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
      render: (minQty: number | null, record: CDStockWithDetails) => (
        <span className="text-sm text-gray-600">
          {minQty || 0} / {record.max_quantity || '-'}
        </span>
      )
    },
    {
      key: 'location',
      title: 'Localização',
      render: (value: string) => value || 'Estoque CD'
    },
    {
      key: 'unit_price',
      title: 'Preço Unitário',
      render: (value: number) => (
        <div>
          <span className="font-medium text-primary-600">
            R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
          </span>
          {value === 0 && (
            <div className="text-xs text-error-600 mt-1">⚠️ Sem preço</div>
          )}
        </div>
      )
    },
    {
      key: 'last_price_update',
      title: 'Última Atualização',
      render: (value: string) => (
        <span className="text-xs text-gray-500">
          {new Date(value).toLocaleDateString('pt-BR')}
        </span>
      )
    },
    {
      key: 'status',
      title: 'Status',
      render: (_: any, record: CDStockWithDetails) => {
        const status = getStockStatus(record.quantity, record.min_quantity);
        return getStatusBadge(status);
      }
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: CDStockWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
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
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDelete(record.id)}
          >
            <TrashIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Estoque CD</h1>
          <p className="mt-1 text-sm text-gray-600">
            Controle de estoque dos Centros de Distribuição
          </p>
        </div>
        <Button
          onClick={() => {
            setEditingStock(null);
            setModalOpen(true);
          }}
          className="w-full sm:w-auto"
        >
          <PlusIcon className="w-4 h-4 mr-2" />
          Ajustar Estoque CD
        </Button>
      </div>

      {/* Informação sobre o módulo */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <BuildingOffice2Icon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 mb-2">📦 Estoque dos Centros de Distribuição</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>Fluxo:</strong> CD → Em Rota → Unidade</p>
              <p><strong>Acesso:</strong> Apenas Administradores e Operadores Almoxarife</p>
              <p><strong>Função:</strong> Controlar estoque que será distribuído para as unidades</p>
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
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filter_cd_unit" className="block text-sm font-medium text-gray-700 mb-1">
              Centro de Distribuição
            </label>
            <select
              id="filter_cd_unit"
              value={filters.cd_unit_id}
              onChange={(e) => setFilters(prev => ({ ...prev, cd_unit_id: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todos os CDs</option>
              {cdUnits.map((unit) => (
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
              onClick={() => setFilters({ cd_unit_id: '', item_id: '', status: '' })}
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
                {cdStock.filter(s => getStockStatus(s.quantity, s.min_quantity) === 'normal').length}
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
                {cdStock.filter(s => getStockStatus(s.quantity, s.min_quantity) === 'low').length}
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
                {cdStock.filter(s => getStockStatus(s.quantity, s.min_quantity) === 'empty').length}
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
              <p className="text-sm sm:text-lg font-semibold text-gray-900">{cdStock.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={cdStock}
          loading={loading}
          emptyMessage="Nenhum item no estoque do CD"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingStock(null);
        }}
        title={editingStock ? 'Editar Estoque CD' : 'Ajustar Estoque CD'}
        size="lg"
      >
        <CDStockForm
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

export default CDStock;