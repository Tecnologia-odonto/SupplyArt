import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { format, startOfMonth } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HeaderProps {
  onMenuClick: () => void;
}

interface StockAlert {
  id: string;
  item_name: string;
  unit_name: string;
  quantity: number;
  min_quantity: number;
  unit_measure: string;
  type: 'stock' | 'cd_stock';
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

interface RequestAlert {
  id: string;
  requesting_unit_name: string;
  status: string;
  created_at: string;
  priority: string;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { signOut, profile } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [requestAlerts, setRequestAlerts] = useState<RequestAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const previousCountRef = useRef(0);

  useEffect(() => {
    fetchAlerts();

    // Setup Realtime subscriptions
    const stockChannel = supabase
      .channel('stock-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'stock' },
        () => {
          console.log('📦 Stock changed, refreshing alerts...');
          fetchAlerts();
        }
      )
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'cd_stock' },
        () => {
          console.log('📦 CD Stock changed, refreshing alerts...');
          fetchAlerts();
        }
      )
      .subscribe();

    const requestChannel = supabase
      .channel('request-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'requests' },
        () => {
          console.log('📋 Request changed, refreshing alerts...');
          fetchAlerts();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(stockChannel);
      supabase.removeChannel(requestChannel);
    };
  }, [profile]);

  const fetchAlerts = async () => {
    if (!profile) return;

    // Verificar se as variáveis de ambiente do Supabase estão configuradas
    if (!import.meta.env.VITE_SUPABASE_URL || !import.meta.env.VITE_SUPABASE_ANON_KEY) {
      console.warn('Supabase environment variables not configured');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const today = new Date();
      const startDate = format(startOfMonth(today), 'yyyy-MM-dd');
      const endDate = format(today, 'yyyy-MM-dd');

      // Fetch stock alerts (items with quantity below min_quantity)
      const { data: stockAlertsData, error: stockError } = await supabase
        .from('stock')
        .select(`
          id,
          quantity,
          min_quantity,
          item:items(name, unit_measure),
          unit:units(name)
        `)
        .not('min_quantity', 'is', null);

      if (stockError) {
        console.error('Error fetching stock alerts:', stockError);
      }

      // Fetch CD stock alerts (items with quantity below min_quantity)
      const { data: cdStockAlertsData, error: cdStockError } = await supabase
        .from('cd_stock')
        .select(`
          id,
          quantity,
          min_quantity,
          item:items(name, unit_measure),
          unit:units(name)
        `)
        .not('min_quantity', 'is', null);

      if (cdStockError) {
        console.error('Error fetching CD stock alerts:', cdStockError);
      }

      // Fetch request alerts (pending requests for approval)
      let requestQuery = supabase
        .from('requests')
        .select(`
          id,
          status,
          priority,
          created_at,
          requesting_unit:units!requests_requesting_unit_id_fkey(name)
        `)
        .in('status', ['solicitado', 'analisando', 'aprovado-pendente']);

      // Filter based on user role
      if (profile.role === 'operador-almoxarife' || profile.role === 'admin') {
        // Show all pending requests
      } else if (profile.unit_id) {
        // Show only requests from user's unit
        requestQuery = requestQuery.eq('requesting_unit_id', profile.unit_id);
      }

      const { data: requestAlertsData, error: requestError } = await requestQuery
        .order('created_at', { ascending: false })
        .limit(5);

      if (requestError) {
        console.error('Error fetching request alerts:', requestError);
      }

      // Fetch expiry alerts (inventory items with expired status)
      const { data: expiryAlertsData, error: expiryError } = await supabase
        .from('inventory')
        .select(`
          id,
          quantity,
          item:items(name),
          unit:units(name)
        `)
        .eq('status', 'expired')
        .limit(5);

      if (expiryError) {
        console.error('Error fetching expiry alerts:', expiryError);
        // Continue with other alerts even if expiry alerts fail
      }

      // Fetch maintenance alerts (inventory items with upcoming maintenance)
      const { data: maintenanceAlertsData, error: maintenanceError } = await supabase
        .from('inventory_events')
        .select(`
          id,
          next_action_date,
          inventory:inventory(
            item:items(name)
          )
        `)
        .not('next_action_date', 'is', null)
        .lte('next_action_date', format(new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000), 'yyyy-MM-dd'))
        .gte('next_action_date', format(today, 'yyyy-MM-dd'))
        .order('next_action_date', { ascending: true })
        .limit(5);

      if (maintenanceError) {
        console.error('Error fetching maintenance alerts:', maintenanceError);
        // Continue even if maintenance alerts fail
      }

      // Format stock alerts (unidades)
      const formattedStockAlerts = (stockAlertsData || [])
        ?.filter(alert => alert.quantity < alert.min_quantity)
        ?.map(alert => ({
          id: alert.id,
          item_name: alert.item.name,
          unit_name: alert.unit.name,
          quantity: alert.quantity,
          min_quantity: alert.min_quantity,
          unit_measure: alert.item.unit_measure,
          type: 'stock' as const
        }));

      // Format CD stock alerts
      const formattedCdStockAlerts = (cdStockAlertsData || [])
        ?.filter(alert => alert.quantity < alert.min_quantity)
        ?.map(alert => ({
          id: alert.id,
          item_name: alert.item.name,
          unit_name: alert.unit.name,
          quantity: alert.quantity,
          min_quantity: alert.min_quantity,
          unit_measure: alert.item.unit_measure,
          type: 'cd_stock' as const
        }));

      // Combine and limit stock alerts
      const allStockAlerts = [
        ...(formattedStockAlerts || []),
        ...(formattedCdStockAlerts || [])
      ].slice(0, 10);

      // Format request alerts
      const formattedRequestAlerts = (requestAlertsData || [])?.map(alert => ({
        id: alert.id,
        requesting_unit_name: alert.requesting_unit.name,
        status: alert.status,
        created_at: alert.created_at,
        priority: alert.priority
      }));

      // Format expiry alerts
      const formattedExpiryAlerts = (expiryAlertsData || [])?.map(alert => ({
        id: alert.id,
        item_name: alert.item.name,
        unit_name: alert.unit.name,
        quantity: alert.quantity
      }));

      // Format maintenance alerts
      const formattedMaintenanceAlerts = (maintenanceAlertsData || [])?.map(alert => {
        const nextDate = new Date(alert.next_action_date);
        const daysRemaining = Math.ceil((nextDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        
        return {
          id: alert.id,
          item_name: alert.inventory.item.name,
          next_maintenance_date: alert.next_action_date,
          days_remaining: daysRemaining
        };
      });

      // Calculate total notifications
      const totalCount =
        (allStockAlerts?.length || 0) +
        (formattedExpiryAlerts?.length || 0) +
        (formattedMaintenanceAlerts?.length || 0) +
        (formattedRequestAlerts?.length || 0);

      // Detect new notifications
      if (previousCountRef.current > 0 && totalCount > previousCountRef.current) {
        setHasNewNotification(true);
        // Play notification sound (optional)
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHmm98OafTwwPUKng77RgGgU7k9n0y3opBSl+zPLaizsIGGS57OihUQ0MW6zn7rFeHQU6kdnzzn0vBSh5ye/glEIKEmm98+mjUw0OWqzl7q9dGgU6k9n0y3spBSh4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIK');
          audio.volume = 0.3;
          audio.play().catch(() => {}); // Ignore if autoplay blocked
        } catch (e) {
          // Ignore audio errors
        }
      }
      previousCountRef.current = totalCount;

      setStockAlerts(allStockAlerts || []);
      setExpiryAlerts(formattedExpiryAlerts || []);
      setMaintenanceAlerts(formattedMaintenanceAlerts || []);
      setRequestAlerts(formattedRequestAlerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      // Set empty arrays to prevent UI issues
      setStockAlerts([]);
      setExpiryAlerts([]);
      setMaintenanceAlerts([]);
      setRequestAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const totalNotifications = stockAlerts.length + expiryAlerts.length + maintenanceAlerts.length + requestAlerts.length;

  return (
    <header className="bg-white shadow-sm border-b border-gray-200">
      <div className="flex items-center justify-between h-16 px-4 sm:px-6">
        {/* Mobile menu button */}
        <button
          type="button"
          className="lg:hidden p-2 rounded-md text-gray-400 hover:text-gray-500 hover:bg-gray-100 focus:outline-none focus:ring-2 focus:ring-inset focus:ring-primary-500"
          onClick={onMenuClick}
        >
          <span className="sr-only">Abrir menu</span>
          <Bars3Icon className="h-6 w-6" aria-hidden="true" />
        </button>

        {/* Logo/Title for mobile */}
        <div className="lg:hidden">
          <h1 className="text-lg font-bold text-primary-600">SupplyArt</h1>
        </div>

        {/* Spacer for desktop */}
        <div className="hidden lg:block flex-1"></div>
        
        {/* Right side */}
        <div className="flex items-center space-x-2 sm:space-x-4">
          <div className="relative">
            <button
              type="button"
              className={`bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 transition-all ${
                hasNewNotification ? 'animate-bounce' : ''
              }`}
              onClick={() => {
                setNotificationsOpen(!notificationsOpen);
                setHasNewNotification(false);
              }}
            >
              <span className="sr-only">Ver notificações</span>
              <BellIcon className="h-6 w-6" aria-hidden="true" />
              {totalNotifications > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 ring-2 ring-white text-white text-xs font-bold">
                  {totalNotifications > 9 ? '9+' : totalNotifications}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {notificationsOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-80 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1" role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                  <div className="px-4 py-2 border-b border-gray-100">
                    <h3 className="text-sm font-medium text-gray-900">Notificações</h3>
                    {totalNotifications === 0 && !loading && (
                      <p className="text-xs text-gray-500 mt-1">Não há notificações no momento</p>
                    )}
                  </div>
                  
                  {loading ? (
                    <div className="px-4 py-3 text-center">
                      <div className="inline-block animate-spin rounded-full h-4 w-4 border-b-2 border-primary-600"></div>
                      <span className="ml-2 text-xs text-gray-500">Carregando...</span>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {requestAlerts.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <h4 className="text-xs font-medium text-primary-800">Pedidos Pendentes</h4>
                          {requestAlerts.map(alert => (
                            <div key={alert.id} className="mt-1 text-xs text-gray-600">
                              • {alert.requesting_unit_name} - {
                                alert.status === 'solicitado' ? 'Aguardando Análise' :
                                alert.status === 'analisando' ? 'Em Análise' :
                                'Aguardando Compra'
                              } {alert.priority === 'urgente' && '🔴'}
                            </div>
                          ))}
                        </div>
                      )}

                      {stockAlerts.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <h4 className="text-xs font-medium text-warning-800">Estoque Baixo</h4>
                          {stockAlerts.map(alert => (
                            <div key={alert.id} className="mt-1 text-xs text-gray-600">
                              {alert.type === 'cd_stock' ? '📦 CD - ' : '🏢 '}
                              {alert.item_name} ({alert.unit_name}): {alert.quantity} de {alert.min_quantity} {alert.unit_measure}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {expiryAlerts.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <h4 className="text-xs font-medium text-error-800">Itens Vencidos</h4>
                          {expiryAlerts.map(alert => (
                            <div key={alert.id} className="mt-1 text-xs text-gray-600">
                              • {alert.item_name} ({alert.unit_name}): {alert.quantity} unidade(s)
                            </div>
                          ))}
                        </div>
                      )}
                      
                      {maintenanceAlerts.length > 0 && (
                        <div className="px-4 py-2">
                          <h4 className="text-xs font-medium text-info-800">Manutenções Programadas</h4>
                          {maintenanceAlerts.map(alert => (
                            <div key={alert.id} className="mt-1 text-xs text-gray-600">
                              • {alert.item_name}: {formatDate(alert.next_maintenance_date)} ({alert.days_remaining} dias)
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                  
                  <div className="px-4 py-2 border-t border-gray-100">
                    <button 
                      onClick={() => setNotificationsOpen(false)}
                      className="w-full text-xs text-center text-primary-600 hover:text-primary-800"
                    >
                      Fechar
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          <div className="flex items-center space-x-2 sm:space-x-3">
            <div className="hidden sm:block text-right">
              <span className="text-sm font-medium text-gray-700 block">
                {profile?.name}
              </span>
              <span className="text-xs text-gray-500 capitalize">
                {profile?.role?.replace('-', ' ')}
              </span>
            </div>
            <button
              onClick={signOut}
              className="bg-accent-500 text-white px-2 sm:px-3 py-1 rounded-md text-xs sm:text-sm font-medium hover:bg-accent-600 transition-colors duration-200"
            >
              Sair
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;