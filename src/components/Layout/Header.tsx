import React, { useState, useEffect, useRef } from 'react';
import { BellIcon, Bars3Icon, XMarkIcon, CheckIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import { supabase } from '../../lib/supabase';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { markNotificationAsRead, markAllNotificationsAsRead } from '../../utils/notificationHelper';
import toast from 'react-hot-toast';

interface HeaderProps {
  onMenuClick: () => void;
}

interface Notification {
  id: string;
  title: string;
  message: string;
  type: string;
  read: boolean;
  priority: string;
  created_at: string;
  reference_id?: string;
  reference_type?: string;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { signOut, profile } = useAuth();
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [loading, setLoading] = useState(true);
  const [hasNewNotification, setHasNewNotification] = useState(false);
  const previousCountRef = useRef(0);

  useEffect(() => {
    if (!profile?.id) return;

    fetchNotifications();

    // Setup Realtime subscription for notifications
    const notificationChannel = supabase
      .channel('user-notifications')
      .on('postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${profile.id}`
        },
        (payload) => {
          console.log('🔔 Notification changed:', payload);
          fetchNotifications();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(notificationChannel);
    };
  }, [profile?.id]);

  const fetchNotifications = async () => {
    if (!profile?.id) return;

    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', profile.id)
        .order('created_at', { ascending: false })
        .limit(20);

      if (error) {
        console.error('Error fetching notifications:', error);
        return;
      }

      const unreadCount = data?.filter(n => !n.read).length || 0;

      // Detect new notifications
      if (previousCountRef.current > 0 && unreadCount > previousCountRef.current) {
        setHasNewNotification(true);
        // Play notification sound
        try {
          const audio = new Audio('data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdJivrJBhNjVgodDbq2EcBj+a2/LDciUFLIHO8tiJNwgZaLvt559NEAxQp+PwtmMcBjiR1/LMeSwFJHfH8N2QQAoUXrTp66hVFApGn+DyvmwhBTGH0fPTgjMGHmm98OafTwwPUKng77RgGgU7k9n0y3opBSl+zPLaizsIGGS57OihUQ0MW6zn7rFeHQU6kdnzzn0vBSh5ye/glEIKEmm98+mjUw0OWqzl7q9dGgU6k9n0y3spBSh4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIKEmm98+mjUw0OWqzn7qtdGgU6k9n0y3spBSl4yO/blEIK');
          audio.volume = 0.3;
          audio.play().catch(() => {});
        } catch (e) {
          // Ignore
        }
      }
      previousCountRef.current = unreadCount;

      setNotifications(data || []);
    } catch (error) {
      console.error('Error fetching notifications:', error);
      setNotifications([]);
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (notificationId: string) => {
    const success = await markNotificationAsRead(notificationId);
    if (success) {
      setNotifications(prev =>
        prev.map(n => n.id === notificationId ? { ...n, read: true } : n)
      );
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!profile?.id) return;

    const success = await markAllNotificationsAsRead(profile.id);
    if (success) {
      setNotifications(prev =>
        prev.map(n => ({ ...n, read: true }))
      );
      toast.success('Todas as notificações marcadas como lidas');
    }
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'stock_low':
      case 'cd_stock_low':
        return '📦';
      case 'request_pending':
      case 'request_approved':
      case 'request_rejected':
        return '📋';
      case 'item_expired':
        return '⚠️';
      case 'maintenance_due':
        return '🔧';
      case 'budget_low':
      case 'budget_exceeded':
        return '💰';
      default:
        return '🔔';
    }
  };

  const getNotificationColor = (type: string, read: boolean) => {
    if (read) return 'bg-gray-50 text-gray-600';

    switch (type) {
      case 'stock_low':
      case 'cd_stock_low':
        return 'bg-yellow-50 text-yellow-900';
      case 'request_pending':
        return 'bg-blue-50 text-blue-900';
      case 'item_expired':
      case 'budget_exceeded':
        return 'bg-red-50 text-red-900';
      default:
        return 'bg-white text-gray-900';
    }
  };

  const formatDate = (dateString: string) => {
    return format(new Date(dateString), 'dd/MM/yyyy HH:mm', { locale: ptBR });
  };

  const unreadCount = notifications.filter(n => !n.read).length;

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
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex items-center justify-center h-5 w-5 rounded-full bg-red-500 ring-2 ring-white text-white text-xs font-bold">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {/* Notifications dropdown */}
            {notificationsOpen && (
              <div className="origin-top-right absolute right-0 mt-2 w-96 rounded-md shadow-lg bg-white ring-1 ring-black ring-opacity-5 focus:outline-none z-50">
                <div className="py-1" role="menu">
                  <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
                    <h3 className="text-sm font-medium text-gray-900">Notificações</h3>
                    {unreadCount > 0 && (
                      <button
                        onClick={handleMarkAllAsRead}
                        className="text-xs text-primary-600 hover:text-primary-800 flex items-center gap-1"
                      >
                        <CheckIcon className="h-4 w-4" />
                        Marcar todas como lida
                      </button>
                    )}
                  </div>

                  {loading ? (
                    <div className="px-4 py-8 text-center">
                      <div className="inline-block animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
                      <span className="ml-2 text-sm text-gray-500">Carregando...</span>
                    </div>
                  ) : notifications.length === 0 ? (
                    <div className="px-4 py-8 text-center">
                      <p className="text-sm text-gray-500">Nenhuma notificação</p>
                    </div>
                  ) : (
                    <div className="max-h-96 overflow-y-auto">
                      {notifications.map(notification => (
                        <div
                          key={notification.id}
                          className={`px-4 py-3 border-b border-gray-100 hover:bg-gray-50 transition-colors ${getNotificationColor(notification.type, notification.read)}`}
                        >
                          <div className="flex items-start gap-3">
                            <span className="text-2xl flex-shrink-0">
                              {getNotificationIcon(notification.type)}
                            </span>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2">
                                <p className={`text-sm font-medium ${notification.read ? 'text-gray-700' : 'text-gray-900'}`}>
                                  {notification.title}
                                </p>
                                {!notification.read && (
                                  <button
                                    onClick={() => handleMarkAsRead(notification.id)}
                                    className="flex-shrink-0 text-primary-600 hover:text-primary-800"
                                    title="Marcar como lida"
                                  >
                                    <CheckIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                              <p className={`text-xs mt-1 ${notification.read ? 'text-gray-500' : 'text-gray-700'}`}>
                                {notification.message}
                              </p>
                              <p className="text-xs text-gray-400 mt-1">
                                {formatDate(notification.created_at)}
                              </p>
                            </div>
                          </div>
                        </div>
                      ))}
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
