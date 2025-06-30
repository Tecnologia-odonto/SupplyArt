import React, { useEffect, useState } from 'react';
import { 
  CubeIcon, 
  BuildingOffice2Icon, 
  ShoppingCartIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon,
  CalendarIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';
import { format, startOfMonth, endOfMonth, parseISO, isValid, subDays } from 'date-fns';
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
  status: string;
}

interface MaintenanceAlert {
  id: string;
  item_name: string;
  inventory_id: string;
  next_maintenance_date: string;
  days_remaining: number;
}

interface ActivityLog {
  id: string;
  action: string;
  table_name: string;
  created_at: string;
  user_name: string;
  description: string;
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
  const [recentActivity, setRecentActivity] = useState<ActivityLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [units, setUnits] = useState<any[]>([]);
  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState<string>(() => {
    return format(startOfMonth(new Date()), 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => {
    return format(new Date(), 'yyyy-MM-dd');
  });
  
  const { profile } = useAuth();
  const permissions = usePermissions();
  
  const canFilterUnits = profile?.role && ['admin', 'gestor'].includes(profile.role);

  useEffect(() => {
    fetchUnits();
  }, []);

  useEffect(() => {
    // Set default unit based on user profile
    if (profile && profile.unit_id && !selectedUnitId) {
      setSelectedUnitId(profile.unit_id);
    }
  }, [profile]);

  useEffect(() => {
    fetchDashboardData();
  }, [selectedUnitId, startDate, endDate, profile]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchDashboardData = async () => {
    setLoading(true);
    try {
      const unitId = selectedUnitId || profile?.unit_id;
      
      // Fetch basic stats
      const itemsResult = await supabase.from('items').select('id', { count: 'exact', head: true });
      
      const unitsResult = await supabase
        .from('units')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', startDate ? `${startDate}T00:00:00` : null)
        .lte('created_at', endDate ? `${endDate}T23:59:59` : null);
      
      // Pending purchases - only filter by unit_id if unitId exists
      let purchasesQuery = supabase
        .from('purchases')
        .select('id', { count: 'exact', head: true })
        .neq('status', 'finalizado');
      
      if (unitId) {
        purchasesQuery = purchasesQuery.eq('unit_id', unitId);
      }
      
      const purchasesResult = await purchasesQuery;
      
      // Monthly expenses - only filter by unit_id if unitId exists
      let expensesQuery = supabase
        .from('financial_transactions')
        .select('amount')
        .eq('type', 'expense')
        .gte('created_at', startDate ? `${startDate}T00:00:00` : null)
        .lte('created_at', endDate ? `${endDate}T23:59:59` : null);
      
      if (unitId) {
        expensesQuery = expensesQuery.eq('unit_id', unitId);
      }
      
      const expensesResult = await expensesQuery;

      // Calculate total expenses
      const expenses = expensesResult.data || [];
      const totalExpense = expenses.reduce((sum, transaction) => sum + (transaction.amount || 0), 0);

      setStats({
        totalItems: itemsResult.count || 0,
        totalUnits: unitsResult.count || 0,
        pendingPurchases: purchasesResult.count || 0,
        monthlyExpense: totalExpense
      });

      // Fetch stock alerts (items below minimum quantity)
      let lowStockQuery = supabase
        .from('stock')
        .select(`
          id,
          quantity,
          min_quantity,
          item:items(name, unit_measure),
          unit:units(name)
        `)
        .not('min_quantity', 'is', null)
        .lt('quantity', 'min_quantity')
        .limit(5);

      if (unitId) {
        lowStockQuery = lowStockQuery.eq('unit_id', unitId);
      }

      const { data: lowStockData } = await lowStockQuery;

      if (lowStockData) {
        setStockAlerts(
          lowStockData.map(item => ({
            id: item.id,
            item_name: item.item?.name || 'Item desconhecido',
            unit_name: item.unit?.name || 'Unidade desconhecida',
            quantity: item.quantity || 0,
            min_quantity: item.min_quantity || 0,
            unit_measure: item.item?.unit_measure || 'un'
          }))
        );
      }

      // Fetch expired inventory items
      let expiredQuery = supabase
        .from('inventory')
        .select(`
          id,
          quantity,
          status,
          item:items(name),
          unit:units(name)
        `)
        .eq('status', 'expired')
        .limit(5);

      if (unitId) {
        expiredQuery = expiredQuery.eq('unit_id', unitId);
      }

      const { data: expiredData } = await expiredQuery;

      if (expiredData) {
        setExpiryAlerts(
          expiredData.map(item => ({
            id: item.id,
            item_name: item.item?.name || 'Item desconhecido',
            unit_name: item.unit?.name || 'Unidade desconhecida',
            quantity: item.quantity || 0,
            status: item.status || 'unknown'
          }))
        );
      }

      // Fetch upcoming maintenance
      const today = new Date();
      const { data: maintenanceData } = await supabase
        .from('inventory_events')
        .select(`
          id,
          inventory_id,
          next_action_date,
          description,
          inventory:inventory(
            item_id,
            unit_id,
            item:items(name),
            unit:units(name, id)
          )
        `)
        .not('next_action_date', 'is', null)
        .gte('next_action_date', today.toISOString().split('T')[0])
        .lte('next_action_date', new Date(today.getTime() + (30 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0])
        .order('next_action_date', { ascending: true })
        .limit(5);

      if (maintenanceData) {
        const filteredMaintenanceData = unitId 
          ? maintenanceData.filter(item => 
              item.inventory?.unit_id === unitId
            )
          : maintenanceData;
        
        setMaintenanceAlerts(
          filteredMaintenanceData.map(item => {
            const nextDate = new Date(item.next_action_date);
            const today = new Date();
            const diffTime = Math.abs(nextDate.getTime() - today.getTime());
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
            
            return {
              id: item.id,
              item_name: item.inventory?.item?.name || 'Item desconhecido',
              inventory_id: item.inventory_id,
              next_maintenance_date: item.next_action_date,
              days_remaining: diffDays
            };
          })
        );
      }

      // Fetch recent activity
      const { data: activityData } = await supabase
        .from('audit_logs')
        .select(`
          id,
          action,
          table_name,
          created_at,
          user:profiles(name)
        `)
        .order('created_at', { ascending: false })
        .limit(5);

      if (activityData) {
        setRecentActivity(
          activityData.map(log => {
            let description = '';
            
            // Generate human-readable description based on action and table
            if (log.action.includes('INSERT') || log.action.includes('CREATE')) {
              description = `Novo registro criado em ${getTableDisplayName(log.table_name)}`;
            } else if (log.action.includes('UPDATE')) {
              description = `Registro atualizado em ${getTableDisplayName(log.table_name)}`;
            } else if (log.action.includes('DELETE')) {
              description = `Registro excluído de ${getTableDisplayName(log.table_name)}`;
            } else if (log.action.includes('LOGIN')) {
              description = 'Login no sistema';
            } else if (log.action.includes('LOGOUT')) {
              description = 'Logout do sistema';
            } else {
              description = `${log.action} em ${getTableDisplayName(log.table_name)}`;
            }
            
            return {
              id: log.id,
              action: log.action,
              table_name: log.table_name,
              created_at: log.created_at,
              user_name: log.user?.name || 'Sistema',
              description
            };
          })
        );
      }

    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
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
      auth: 'Autenticação',
    };

    return tableNames[tableName] || tableName;
  };

  const formatDate = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return '';
      return format(date, "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
    } catch (error) {
      console.error('Error formatting date:', error);
      return dateString;
    }
  };

  const formatDateTime = (dateString: string) => {
    try {
      const date = parseISO(dateString);
      if (!isValid(date)) return '';
      return format(date, "dd/MM/yyyy 'às' HH:mm", { locale: ptBR });
    } catch (error) {
      console.error('Error formatting datetime:', error);
      return dateString;
    }
  };

  const handleQuickDateFilter = (filter: 'today' | 'thisWeek' | 'thisMonth' | 'thisYear') => {
    const today = new Date();
    
    switch (filter) {
      case 'today':
        setStartDate(format(today, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'thisWeek':
        const firstDayOfWeek = new Date(today);
        firstDayOfWeek.setDate(today.getDate() - today.getDay());
        setStartDate(format(firstDayOfWeek, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'thisMonth':
        setStartDate(format(startOfMonth(today), 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
      case 'thisYear':
        const firstDayOfYear = new Date(today.getFullYear(), 0, 1);
        setStartDate(format(firstDayOfYear, 'yyyy-MM-dd'));
        setEndDate(format(today, 'yyyy-MM-dd'));
        break;
    }
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
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
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
              value={selectedUnitId || ''}
              onChange={(e) => setSelectedUnitId(e.target.value || null)}
              disabled={!canFilterUnits}
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                !canFilterUnits ? 'bg-gray-100' : ''
              }`}
            >
              {canFilterUnits && <option value="">Todas as unidades</option>}
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name} {unit.is_cd ? '(CD)' : ''}
                </option>
              ))}
            </select>
            {!canFilterUnits && profile?.unit_id && (
              <p className="mt-1 text-xs text-gray-500">
                Você só pode visualizar dados da sua unidade
              </p>
            )}
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickDateFilter('today')}
          >
            Hoje
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickDateFilter('thisWeek')}
          >
            Esta Semana
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickDateFilter('thisMonth')}
          >
            Este Mês
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => handleQuickDateFilter('thisYear')}
          >
            Este Ano
          </Button>
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
                      <ArrowTrendingUpIcon
                        className="self-center flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-success-500"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Increased by</span>
                      +12%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </Card>
        )}

        {permissions.canRead && (
          <Card className="animate-slide-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <BuildingOffice2Icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" aria-hidden="true" />
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                    Unidades
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                      {stats.totalUnits}
                    </div>
                    <div
                      className="ml-2 flex items-baseline text-xs sm:text-sm font-semibold text-success-600"
                    >
                      <ArrowTrendingUpIcon
                        className="self-center flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-success-500"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Increased by</span>
                      +2%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </Card>
        )}

        {permissions.canAccessPurchases && (
          <Card className="animate-slide-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <ShoppingCartIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" aria-hidden="true" />
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                    Pedidos Pendentes
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                      {stats.pendingPurchases}
                    </div>
                    <div
                      className="ml-2 flex items-baseline text-xs sm:text-sm font-semibold text-error-600"
                    >
                      <ArrowTrendingDownIcon
                        className="self-center flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-error-500"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Decreased by</span>
                      -8%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </Card>
        )}

        {permissions.canAccessFinancial && (
          <Card className="animate-slide-in">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <CurrencyDollarIcon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" aria-hidden="true" />
              </div>
              <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                <dl>
                  <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                    Gasto {startDate === format(startOfMonth(new Date()), 'yyyy-MM-dd') ? 'Mensal' : 'no Período'}
                  </dt>
                  <dd className="flex items-baseline">
                    <div className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                      R$ {stats.monthlyExpense.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                    <div
                      className="ml-2 flex items-baseline text-xs sm:text-sm font-semibold text-success-600"
                    >
                      <ArrowTrendingUpIcon
                        className="self-center flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-success-500"
                        aria-hidden="true"
                      />
                      <span className="sr-only">Increased by</span>
                      +15%
                    </div>
                  </dd>
                </dl>
              </div>
            </div>
          </Card>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
            Atividades Recentes
          </h3>
          {recentActivity.length > 0 ? (
            <div className="space-y-3">
              {recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start space-x-3">
                  <div className="flex-shrink-0 w-2 h-2 bg-primary-400 rounded-full mt-2"></div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm text-gray-600">
                      {activity.description} por {activity.user_name}
                    </p>
                    <span className="text-xs text-gray-400">
                      {formatDateTime(activity.created_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 text-center py-4">
              Nenhuma atividade recente encontrada no período selecionado
            </p>
          )}
        </Card>

        <Card>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
            Alertas
          </h3>
          <div className="space-y-3">
            {stockAlerts.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-warning-800">
                    Estoque Baixo
                  </p>
                  <div className="text-xs text-warning-600 mt-1">
                    {stockAlerts.map((alert, index) => (
                      <p key={alert.id} className="mb-1">
                        • {alert.item_name} ({alert.unit_name}): {alert.quantity} de {alert.min_quantity} {alert.unit_measure}
                      </p>
                    ))}
                  </div>
                </div>
                <span className="text-warning-600 font-semibold flex-shrink-0 ml-2">!</span>
              </div>
            )}
            
            {expiryAlerts.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-error-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-error-800">
                    Itens Vencidos
                  </p>
                  <div className="text-xs text-error-600 mt-1">
                    {expiryAlerts.map((alert, index) => (
                      <p key={alert.id} className="mb-1">
                        • {alert.item_name} ({alert.unit_name}): {alert.quantity} unidade(s)
                      </p>
                    ))}
                  </div>
                </div>
                <span className="text-error-600 font-semibold flex-shrink-0 ml-2">!</span>
              </div>
            )}
            
            {maintenanceAlerts.length > 0 && (
              <div className="flex items-center justify-between p-3 bg-info-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-info-800">
                    Manutenções Programadas
                  </p>
                  <div className="text-xs text-info-600 mt-1">
                    {maintenanceAlerts.map((alert, index) => (
                      <p key={alert.id} className="mb-1">
                        • {alert.item_name}: {formatDate(alert.next_maintenance_date)} ({alert.days_remaining} dias)
                      </p>
                    ))}
                  </div>
                </div>
                <span className="text-info-600 font-semibold flex-shrink-0 ml-2">i</span>
              </div>
            )}
            
            {stockAlerts.length === 0 && expiryAlerts.length === 0 && maintenanceAlerts.length === 0 && (
              <div className="flex items-center justify-between p-3 bg-success-50 rounded-lg">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-success-800">
                    Tudo em Ordem
                  </p>
                  <p className="text-xs text-success-600 mt-1">
                    Não há alertas pendentes no momento
                  </p>
                </div>
                <span className="text-success-600 font-semibold flex-shrink-0 ml-2">✓</span>
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Período do Dashboard */}
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
        <div className="flex items-center">
          <ExclamationTriangleIcon className="h-5 w-5 text-gray-400 mr-2" />
          <div>
            <h4 className="text-sm font-medium text-gray-700">Informações do Dashboard</h4>
            <p className="text-xs text-gray-500 mt-1">
              Dados exibidos para o período de {formatDate(startDate)} até {formatDate(endDate)}
              {selectedUnitId ? ` para a unidade ${units.find(u => u.id === selectedUnitId)?.name || ''}` : ''}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;