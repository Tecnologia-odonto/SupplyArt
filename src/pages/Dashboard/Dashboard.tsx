import React, { useEffect, useState } from 'react';
import { 
  CubeIcon, 
  BuildingOffice2Icon, 
  ShoppingCartIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  ExclamationTriangleIcon,
  CalendarIcon,
  FunnelIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { format, startOfMonth, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DashboardStats {
  totalItems: number;
  totalUnits: number;
  pendingPurchases: number;
  monthlyExpense: number;
}

interface StockAlert {
  id: string;
  item_name: string;
  unit_name: string;
  quantity: number;
  min_quantity: number;
  unit_measure: string;
}

interface ExpiryAlert {
  id: string;
  item_name: string;
  unit_name: string;
  quantity: number;
}

interface MaintenanceAlert {
  id: string;
  item_name: string;
  next_maintenance_date: string;
  days_remaining: number;
}

interface RecentActivity {
  id: string;
  description: string;
  user_name: string;
  created_at: string;
}

interface Unit {
  id: string;
  name: string;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalUnits: 0,
    pendingPurchases: 0,
    monthlyExpense: 0
  });
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<Unit[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string>('');
  const [startDate, setStartDate] = useState(() => {
    return format(startOfMonth(new Date()), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });
  
  const { profile } = useAuth();
  const permissions = usePermissions();

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    if (profile) {
      // Se o usuário for operador administrativo, selecionar automaticamente sua unidade
      if (profile.role === 'operador-administrativo' && profile.unit_id) {
        setSelectedUnitId(profile.unit_id);
      }
    }
  }, [profile]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedUnitId, startDate, endDate]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchDashboardData = async () => {
    try {
      setLoading(true);

      // Fetch total items
      const { count: itemsCount, error: itemsError } = await supabase
        .from('items')
        .select('id', { count: 'exact', head: true });

      if (itemsError) throw itemsError;

      // Fetch total units
      const { count: unitsCount, error: unitsError } = await supabase
        .from('units')
        .select('id', { count: 'exact', head: true });

      if (unitsError) throw unitsError;

      // Fetch pending purchases
      let purchasesQuery = supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'finalizado');

      if (selectedUnitId) {
        purchasesQuery = purchasesQuery.eq('unit_id', selectedUnitId);
      }

      const { count: purchasesCount, error: purchasesError } = await purchasesQuery;

      if (purchasesError) throw purchasesError;

      // Fetch monthly expense
      let expenseQuery = supabase
        .from('financial_transactions')
        .select('amount')
        .eq('type', 'expense')
        .gte('created_at', `${startDate}T00:00:00`)
        .lte('created_at', `${endDate}T23:59:59`);

      if (selectedUnitId) {
        expenseQuery = expenseQuery.eq('unit_id', selectedUnitId);
      }

      const { data: expenses, error: expensesError } = await expenseQuery;

      if (expensesError) throw expensesError;

      const totalExpense = expenses?.reduce((sum, transaction) => sum + transaction.amount, 0) || 0;

      // Fetch stock alerts (items with quantity below min_quantity)
      let stockAlertsQuery = supabase
        .from('stock')
        .select(`
          id,
          quantity,
          min_quantity,
          item:items(name, unit_measure),
          unit:units(name)
        `)
        .not('min_quantity', 'is', null)
        .filter('quantity', 'lt', 'min_quantity')
        .limit(5);

      if (selectedUnitId) {
        stockAlertsQuery = stockAlertsQuery.eq('unit_id', selectedUnitId);
      }

      const { data: stockAlertsData, error: stockError } = await stockAlertsQuery;

      if (stockError) throw stockError;

      // Fetch expiry alerts (inventory items with expired status)
      let expiryAlertsQuery = supabase
        .from('inventory')
        .select(`
          id,
          quantity,
          item:items(name),
          unit:units(name)
        `)
        .eq('status', 'expired')
        .limit(5);

      if (selectedUnitId) {
        expiryAlertsQuery = expiryAlertsQuery.eq('unit_id', selectedUnitId);
      }

      const { data: expiryAlertsData, error: expiryError } = await expiryAlertsQuery;

      if (expiryError) throw expiryError;

      // Fetch maintenance alerts (inventory items with upcoming maintenance)
      const today = new Date();
      const { data: maintenanceAlertsData, error: maintenanceError } = await supabase
        .from('inventory_events')
        .select(`
          id,
          next_action_date,
          inventory:inventory(
            item:items(name),
            unit_id
          )
        `)
        .not('next_action_date', 'is', null)
        .lte('next_action_date', format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
        .gte('next_action_date', format(today, 'yyyy-MM-dd'))
        .order('next_action_date', { ascending: true })
        .limit(5);

      if (maintenanceError) throw maintenanceError;

      // Filter maintenance alerts by unit if needed
      const filteredMaintenanceAlerts = selectedUnitId 
        ? maintenanceAlertsData?.filter(alert => alert.inventory.unit_id === selectedUnitId) 
        : maintenanceAlertsData;

      // Fetch recent activity from audit logs
      let activityQuery = supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          table_name,
          created_at,
          user:profiles(name)
        `)
        .in('action', ['INSERT', 'UPDATE', 'DELETE', 'PURCHASE_FINALIZED', 'REQUEST_APPROVED'])
        .order('created_at', { ascending: false })
        .limit(5);

      const { data: activityData, error: activityError } = await activityQuery;

      if (activityError) throw activityError;

      // Format stock alerts
      const formattedStockAlerts = stockAlertsData?.map(alert => ({
        id: alert.id,
        item_name: alert.item.name,
        unit_name: alert.unit.name,
        quantity: alert.quantity,
        min_quantity: alert.min_quantity,
        unit_measure: alert.item.unit_measure
      })) || [];

      // Format expiry alerts
      const formattedExpiryAlerts = expiryAlertsData?.map(alert => ({
        id: alert.id,
        item_name: alert.item.name,
        unit_name: alert.unit.name,
        quantity: alert.quantity
      })) || [];

      // Format maintenance alerts
      const formattedMaintenanceAlerts = filteredMaintenanceAlerts?.map(alert => {
        const nextDate = new Date(alert.next_action_date);
        const daysRemaining = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: alert.id,
          item_name: alert.inventory.item.name,
          next_maintenance_date: alert.next_action_date,
          days_remaining: daysRemaining
        };
      }) || [];

      // Format recent activity
      const formattedActivity = activityData?.map(activity => {
        let description = '';
        
        switch (activity.action) {
          case 'INSERT':
            description = `Novo registro criado em ${getTableDisplayName(activity.table_name)}`;
            break;
          case 'UPDATE':
            description = `Registro atualizado em ${getTableDisplayName(activity.table_name)}`;
            break;
          case 'DELETE':
            description = `Registro excluído de ${getTableDisplayName(activity.table_name)}`;
            break;
          case 'PURCHASE_FINALIZED':
            description = 'Compra finalizada e adicionada ao estoque';
            break;
          case 'REQUEST_APPROVED':
            description = 'Pedido interno aprovado';
            break;
          default:
            description = `Ação ${activity.action} em ${getTableDisplayName(activity.table_name)}`;
        }
        
        return {
          id: activity.id,
          description,
          user_name: activity.user?.name || 'Sistema',
          created_at: activity.created_at
        };
      }) || [];

      setStats({
        totalItems: itemsCount || 0,
        totalUnits: unitsCount || 0,
        pendingPurchases: purchasesCount || 0,
        monthlyExpense: totalExpense
      });
      
      setStockAlerts(formattedStockAlerts);
      setExpiryAlerts(formattedExpiryAlerts);
      setMaintenanceAlerts(formattedMaintenanceAlerts);
      setRecentActivity(formattedActivity);
    } catch (error) {
      console.error('Error fetching dashboard data:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTableDisplayName = (tableName: string) => {
    const tableNames: Record<string, string> = {
      profiles: 'Usuários',
      units: 'Unidades',
      items: 'Itens',
      suppliers: 'Fornecedores',
      stock: 'Estoque',
      inventory: 'Inventário',
      inventory_items: 'Itens de Inventário',
      inventory_events: 'Eventos de Inventário',
      requests: 'Pedidos Internos',
      request_items: 'Itens de Pedidos',
      purchases: 'Compras',
      purchase_items: 'Itens de Compras',
      movements: 'Movimentações',
      financial_transactions: 'Transações Financeiras',
      unit_budgets: 'Orçamentos',
    };

    return tableNames[tableName] || tableName;
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const formatDateTime = (dateTimeString: string) => {
    const date = parseISO(dateTimeString);
    const now = new Date();
    const diffInHours = Math.abs(now.getTime() - date.getTime()) / 36e5;
    
    if (diffInHours < 24) {
      if (diffInHours < 1) {
        const minutes = Math.floor(diffInHours * 60);
        return `há ${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;
      }
      return `há ${Math.floor(diffInHours)} ${Math.floor(diffInHours) === 1 ? 'hora' : 'horas'}`;
    }
    
    return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-5">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Bem-vindo, {profile?.name}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Visão geral do sistema SupplyArt
        </p>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex items-center mb-4">
          <CalendarIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros do Dashboard</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade
            </label>
            <select
              id="unit_id"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              disabled={profile?.role === 'operador-administrativo'}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                profile?.role === 'operador-administrativo' ? 'bg-gray-100' : ''
              }`}
            >
              {permissions.canAccessAllUnits && (
                <option value="">Todas as unidades</option>
              )}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {profile?.role === 'operador-administrativo' && (
              <p className="mt-1 text-xs text-gray-500">
                Como operador administrativo, você só pode ver dados da sua unidade
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => {
              const today = new Date();
              setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
              setEndDate(format(today, 'yyyy-MM-dd'));
            }}
          >
            Mês Atual
          </button>
          <button
            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => {
              const today = new Date();
              const lastMonth = new Date(today);
              lastMonth.setMonth(lastMonth.getMonth() - 1);
              setStartDate(format(startOfMonth(lastMonth), 'yyyy-MM-dd'));
              setEndDate(format(new Date(today.getFullYear(), today.getMonth(), 0), 'yyyy-MM-dd'));
            }}
          >
            Mês Anterior
          </button>
          <button
            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => {
              const today = new Date();
              const lastWeek = new Date(today);
              lastWeek.setDate(lastWeek.getDate() - 7);
              setStartDate(format(lastWeek, 'yyyy-MM-dd'));
              setEndDate(format(today, 'yyyy-MM-dd'));
            }}
          >
            Últimos 7 dias
          </button>
          <button
            className="px-3 py-1 text-xs font-medium rounded-md border border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            onClick={() => {
              const today = new Date();
              setStartDate(format(today, 'yyyy-MM-dd'));
              setEndDate(format(today, 'yyyy-MM-dd'));
            }}
          >
            Hoje
          </button>
        </div>
      </Card>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {permissions.canRead && (
          <Card className="animate-slide-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CubeIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" aria-hidden="true" />
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                    Total de Itens
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                      {stats.totalItems}
                    </div>
                    <div
                      className="ml-2 flex items-baseline text-xs sm:text-sm font-semibold text-success-600"
                    >
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default Dashboard;