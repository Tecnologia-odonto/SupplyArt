import { supabase } from '../lib/supabase';

interface AuditLogData {
  action: string;
  tableName: string;
  recordId?: string;
  oldValues?: any;
  newValues?: any;
  userId?: string;
}

export const createAuditLog = async ({
  action,
  tableName,
  recordId,
  oldValues,
  newValues,
  userId
}: AuditLogData) => {
  try {
    // Get current user if not provided
    let currentUserId = userId;
    if (!currentUserId) {
      const { data: { user } } = await supabase.auth.getUser();
      currentUserId = user?.id || '00000000-0000-0000-0000-000000000000';
    }

    await supabase.from('audit_logs').insert({
      user_id: currentUserId,
      action,
      table_name: tableName,
      record_id: recordId || null,
      old_values: oldValues || null,
      new_values: newValues || null
    });
  } catch (error) {
    console.error('Error creating audit log:', error);
    // Don't throw error to avoid breaking the main operation
  }
};

// Helper function to create movement logs
export const createMovementLog = async (
  itemId: string,
  fromUnitId: string,
  toUnitId: string,
  quantity: number,
  type: 'stock_to_inventory' | 'inventory_to_stock' | 'transfer' | 'adjustment',
  reference?: string
) => {
  try {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase.from('movements').insert({
      item_id: itemId,
      from_unit_id: fromUnitId,
      to_unit_id: toUnitId,
      quantity,
      type: type === 'stock_to_inventory' || type === 'inventory_to_stock' ? 'transfer' : type,
      reference: reference || `${type.replace('_', ' ')} operation`,
      notes: `Automated ${type.replace('_', ' ')} movement`,
      created_by: user.id
    });

    // Also create audit log
    await createAuditLog({
      action: 'MOVEMENT_CREATED',
      tableName: 'movements',
      newValues: {
        item_id: itemId,
        from_unit_id: fromUnitId,
        to_unit_id: toUnitId,
        quantity,
        type,
        reference,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('Error creating movement log:', error);
  }
};