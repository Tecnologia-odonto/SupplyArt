import { supabase } from '../lib/supabase';

interface NotificationData {
  userId: string;
  type: 'stock_low' | 'cd_stock_low' | 'request_pending' | 'request_approved' | 'request_rejected' | 'item_expired' | 'maintenance_due' | 'budget_low' | 'budget_exceeded';
  title: string;
  message: string;
  referenceId?: string;
  referenceType?: 'stock' | 'cd_stock' | 'request' | 'inventory' | 'budget';
  priority?: 'normal' | 'high' | 'urgent';
}

export const createNotification = async (data: NotificationData) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .insert({
        user_id: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        reference_id: data.referenceId,
        reference_type: data.referenceType,
        priority: data.priority || 'normal',
        read: false,
      });

    if (error) {
      console.error('Error creating notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error creating notification:', error);
    return false;
  }
};

export const markNotificationAsRead = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('id', notificationId);

    if (error) {
      console.error('Error marking notification as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking notification as read:', error);
    return false;
  }
};

export const markAllNotificationsAsRead = async (userId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .update({
        read: true,
        read_at: new Date().toISOString(),
      })
      .eq('user_id', userId)
      .eq('read', false);

    if (error) {
      console.error('Error marking all notifications as read:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    return false;
  }
};

export const deleteNotification = async (notificationId: string) => {
  try {
    const { error } = await supabase
      .from('notifications')
      .delete()
      .eq('id', notificationId);

    if (error) {
      console.error('Error deleting notification:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Error deleting notification:', error);
    return false;
  }
};

// Gerar notificações de estoque baixo para usuários relevantes
export const generateStockLowNotifications = async (
  stockId: string,
  itemName: string,
  unitName: string,
  quantity: number,
  minQuantity: number,
  type: 'stock' | 'cd_stock'
) => {
  try {
    // Buscar usuários que devem receber notificação (admin e almoxarife)
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'operador-almoxarife']);

    if (!users || users.length === 0) return;

    const notifications = users.map(user => ({
      user_id: user.id,
      type: type === 'stock' ? 'stock_low' : 'cd_stock_low',
      title: 'Estoque Baixo',
      message: `${itemName} em ${unitName} está com ${quantity} unidades (mínimo: ${minQuantity})`,
      reference_id: stockId,
      reference_type: type,
      priority: quantity === 0 ? 'urgent' : 'high',
      read: false,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Error generating stock low notifications:', error);
    }
  } catch (error) {
    console.error('Error generating stock low notifications:', error);
  }
};

// Gerar notificação de pedido pendente
export const generateRequestNotification = async (
  requestId: string,
  unitName: string,
  status: string,
  priority: string
) => {
  try {
    // Buscar usuários que devem receber notificação (admin, almoxarife e gestores)
    const { data: users } = await supabase
      .from('profiles')
      .select('id')
      .in('role', ['admin', 'operador-almoxarife', 'gestor', 'operador-financeiro']);

    if (!users || users.length === 0) return;

    const statusText =
      status === 'solicitado' ? 'Novo Pedido Aguardando Análise' :
      status === 'analisando' ? 'Pedido Em Análise' :
      'Pedido Aguardando Compra';

    const notifications = users.map(user => ({
      user_id: user.id,
      type: 'request_pending',
      title: 'Pedido Pendente',
      message: `${unitName} - ${statusText}`,
      reference_id: requestId,
      reference_type: 'request',
      priority: priority === 'urgente' ? 'urgent' : priority === 'alta' ? 'high' : 'normal',
      read: false,
    }));

    const { error } = await supabase
      .from('notifications')
      .insert(notifications);

    if (error) {
      console.error('Error generating request notification:', error);
    }
  } catch (error) {
    console.error('Error generating request notification:', error);
  }
};
