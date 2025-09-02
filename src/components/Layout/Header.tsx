import React, { useState, useEffect } from 'react';
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

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { signOut, profile } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [stockAlerts, setStockAlerts] = useState<StockAlert[]>([]);
  const [expiryAlerts, setExpiryAlerts] = useState<ExpiryAlert[]>([]);
  const [maintenanceAlerts, setMaintenanceAlerts] = useState<MaintenanceAlert[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchAlerts();
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
        // Continue with other alerts even if stock alerts fail
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

      // Format stock alerts
      const formattedStockAlerts = (stockAlertsData || [])
        ?.filter(alert => alert.quantity < alert.min_quantity)
        ?.slice(0, 5)
        ?.map(alert => ({
        id: alert.id,
        item_name: alert.item.name,
        unit_name: alert.unit.name,
        quantity: alert.quantity,
        min_quantity: alert.min_quantity,
        unit_measure: alert.item.unit_measure
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

      setStockAlerts(formattedStockAlerts || []);
      setExpiryAlerts(formattedExpiryAlerts || []);
      setMaintenanceAlerts(formattedMaintenanceAlerts || []);
    } catch (error) {
      console.error('Error fetching alerts:', error);
      // Set empty arrays to prevent UI issues
      setStockAlerts([]);
      setExpiryAlerts([]);
      setMaintenanceAlerts([]);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy', { locale: ptBR });
  };

  const totalNotifications = stockAlerts.length + expiryAlerts.length + maintenanceAlerts.length;

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
              className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
              onClick={() => setNotificationsOpen(!notificationsOpen)}
            >
              <span className="sr-only">Ver notificações</span>
              <BellIcon className="h-6 w-6" aria-hidden="true" />
              {totalNotifications > 0 && (
                <span className="absolute top-0 right-0 block h-2 w-2 rounded-full bg-red-400 ring-2 ring-white"></span>
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
                    <div className="max-h-60 overflow-y-auto">
                      {stockAlerts.length > 0 && (
                        <div className="px-4 py-2 border-b border-gray-100">
                          <h4 className="text-xs font-medium text-warning-800">Estoque Baixo</h4>
                          {stockAlerts.map(alert => (
                            <div key={alert.id} className="mt-1 text-xs text-gray-600">
                              • {alert.item_name} ({alert.unit_name}): {alert.quantity} de {alert.min_quantity} {alert.unit_measure}
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