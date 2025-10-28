import { supabase } from '../lib/supabase';

interface AuditLogParams {
  action: string;
  tableName: string;
  recordId: string;
  oldValues?: any;
  newValues?: any;
  details?: string;
}

export async function createAuditLog(params: AuditLogParams): Promise<void> {
  const { action, tableName, recordId, oldValues, newValues, details } = params;

  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('No user found for audit log');
      return;
    }

    const logEntry = {
      user_id: user.id,
      action,
      table_name: tableName,
      record_id: recordId,
      old_values: oldValues || null,
      new_values: newValues || null,
      details: details || null,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('audit_logs')
      .insert(logEntry);

    if (error) {
      console.error('Error creating audit log:', error);
    }
  } catch (error) {
    console.error('Exception creating audit log:', error);
  }
}

export async function createMovementLog(
  itemId: string,
  fromUnitId: string,
  toUnitId: string,
  quantity: number,
  movementType: string,
  notes?: string
): Promise<void> {
  try {
    const { data: { user } } = await supabase.auth.getUser();

    if (!user) {
      console.error('No user found for movement log');
      return;
    }

    const movementEntry = {
      item_id: itemId,
      from_unit_id: fromUnitId,
      to_unit_id: toUnitId,
      quantity,
      movement_type: movementType,
      notes: notes || null,
      moved_by: user.id,
      created_at: new Date().toISOString()
    };

    const { error } = await supabase
      .from('stock_movements')
      .insert(movementEntry);

    if (error) {
      console.error('Error creating movement log:', error);
    }
  } catch (error) {
    console.error('Exception creating movement log:', error);
  }
}
