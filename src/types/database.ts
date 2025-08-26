export type Database = {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string;
          name: string;
          email: string;
          role: 'admin' | 'gestor' | 'operador-financeiro' | 'operador-administrativo' | 'operador-almoxarife';
          unit_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          name: string;
          email: string;
          role: 'admin' | 'gestor' | 'operador-financeiro' | 'operador-administrativo' | 'operador-almoxarife';
          unit_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          email?: string;
          role?: 'admin' | 'gestor' | 'operador-financeiro' | 'operador-administrativo' | 'operador-almoxarife';
          unit_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      units: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          address: string | null;
          is_cd: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          address?: string | null;
          is_cd?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          address?: string | null;
          is_cd?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      items: {
        Row: {
          id: string;
          code: string;
          name: string;
          description: string | null;
          unit_measure: string;
          category: string | null;
          show_in_company: boolean;
          has_lifecycle: boolean;
          requires_maintenance: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          code: string;
          name: string;
          description?: string | null;
          unit_measure: string;
          category?: string | null;
          show_in_company?: boolean;
          has_lifecycle?: boolean;
          requires_maintenance?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          code?: string;
          name?: string;
          description?: string | null;
          unit_measure?: string;
          category?: string | null;
          show_in_company?: boolean;
          has_lifecycle?: boolean;
          requires_maintenance?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      stock: {
        Row: {
          id: string;
          item_id: string;
          unit_id: string;
          quantity: number;
          min_quantity: number | null;
          max_quantity: number | null;
          location: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          unit_id: string;
          quantity: number;
          min_quantity?: number | null;
          max_quantity?: number | null;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          unit_id?: string;
          quantity?: number;
          min_quantity?: number | null;
          max_quantity?: number | null;
          location?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory: {
        Row: {
          id: string;
          item_id: string;
          unit_id: string;
          quantity: number;
          location: string;
          status: 'available' | 'reserved' | 'damaged' | 'expired';
          notes: string | null;
          description: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          unit_id: string;
          quantity: number;
          location: string;
          status?: 'available' | 'reserved' | 'damaged' | 'expired';
          notes?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          unit_id?: string;
          quantity?: number;
          location?: string;
          status?: 'available' | 'reserved' | 'damaged' | 'expired';
          notes?: string | null;
          description?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory_items: {
        Row: {
          id: string;
          inventory_id: string;
          item_code: string;
          serial_number: string | null;
          invoice_number: string | null;
          purchase_date: string | null;
          warranty_end_date: string | null;
          status: 'working' | 'maintenance' | 'broken' | 'disposed';
          last_maintenance_date: string | null;
          next_maintenance_date: string | null;
          maintenance_interval_days: number | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          inventory_id: string;
          item_code: string;
          serial_number?: string | null;
          invoice_number?: string | null;
          purchase_date?: string | null;
          warranty_end_date?: string | null;
          status?: 'working' | 'maintenance' | 'broken' | 'disposed';
          last_maintenance_date?: string | null;
          next_maintenance_date?: string | null;
          maintenance_interval_days?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          inventory_id?: string;
          item_code?: string;
          serial_number?: string | null;
          invoice_number?: string | null;
          purchase_date?: string | null;
          warranty_end_date?: string | null;
          status?: 'working' | 'maintenance' | 'broken' | 'disposed';
          last_maintenance_date?: string | null;
          next_maintenance_date?: string | null;
          maintenance_interval_days?: number | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      inventory_events: {
        Row: {
          id: string;
          inventory_id: string;
          event_type: 'maintenance' | 'repair' | 'inspection' | 'relocation' | 'status_change' | 'other';
          description: string;
          performed_by: string | null;
          cost: number | null;
          notes: string | null;
          event_date: string;
          next_action_date: string | null;
          supplier_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          inventory_id: string;
          event_type: 'maintenance' | 'repair' | 'inspection' | 'relocation' | 'status_change' | 'other';
          description: string;
          performed_by?: string | null;
          cost?: number | null;
          notes?: string | null;
          event_date?: string;
          next_action_date?: string | null;
          supplier_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          inventory_id?: string;
          event_type?: 'maintenance' | 'repair' | 'inspection' | 'relocation' | 'status_change' | 'other';
          description?: string;
          performed_by?: string | null;
          cost?: number | null;
          notes?: string | null;
          event_date?: string;
          next_action_date?: string | null;
          supplier_id?: string | null;
          created_at?: string;
        };
      };
      requests: {
        Row: {
          id: string;
          requesting_unit_id: string;
          cd_unit_id: string;
          requester_id: string;
          status: 'solicitado' | 'analisando' | 'aprovado' | 'aprovado-pendente' | 'rejeitado' | 'preparando' | 'enviado' | 'recebido' | 'aprovado-unidade' | 'erro-pedido' | 'cancelado';
          priority: 'baixa' | 'normal' | 'alta' | 'urgente';
          notes: string | null;
          rejection_reason: string | null;
          approved_by: string | null;
          approved_at: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          requesting_unit_id: string;
          cd_unit_id: string;
          requester_id: string;
          status?: 'solicitado' | 'analisando' | 'aprovado' | 'aprovado-pendente' | 'rejeitado' | 'preparando' | 'enviado' | 'recebido' | 'aprovado-unidade' | 'erro-pedido' | 'cancelado';
          priority?: 'baixa' | 'normal' | 'alta' | 'urgente';
          notes?: string | null;
          rejection_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          requesting_unit_id?: string;
          cd_unit_id?: string;
          requester_id?: string;
          status?: 'solicitado' | 'analisando' | 'aprovado' | 'aprovado-pendente' | 'rejeitado' | 'preparando' | 'enviado' | 'recebido' | 'aprovado-unidade' | 'erro-pedido' | 'cancelado';
          priority?: 'baixa' | 'normal' | 'alta' | 'urgente';
          notes?: string | null;
          rejection_reason?: string | null;
          approved_by?: string | null;
          approved_at?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      request_items: {
        Row: {
          id: string;
          request_id: string;
          item_id: string;
          quantity_requested: number;
          quantity_approved: number | null;
          quantity_sent: number | null;
          cd_stock_available: number | null;
          needs_purchase: boolean;
          notes: string | null;
          unit_price: number | null;
          has_error: boolean;
          error_description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          request_id: string;
          item_id: string;
          quantity_requested: number;
          quantity_approved?: number | null;
          quantity_sent?: number | null;
          cd_stock_available?: number | null;
          needs_purchase?: boolean;
          notes?: string | null;
          unit_price?: number | null;
          has_error?: boolean;
          error_description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          request_id?: string;
          item_id?: string;
          quantity_requested?: number;
          quantity_approved?: number | null;
          quantity_sent?: number | null;
          cd_stock_available?: number | null;
          needs_purchase?: boolean;
          notes?: string | null;
          unit_price?: number | null;
          has_error?: boolean;
          error_description?: string | null;
          created_at?: string;
        };
      };
      purchases: {
        Row: {
          id: string;
          unit_id: string;
          requester_id: string;
          status: 'pedido-realizado' | 'em-cotacao' | 'comprado-aguardando' | 'chegou-cd' | 'enviado' | 'erro-pedido' | 'finalizado';
          supplier_id: string | null;
          total_value: number | null;
          notes: string | null;
          request_id: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          requester_id: string;
          status?: 'pedido-realizado' | 'em-cotacao' | 'comprado-aguardando' | 'chegou-cd' | 'enviado' | 'erro-pedido' | 'finalizado';
          supplier_id?: string | null;
          total_value?: number | null;
          notes?: string | null;
          request_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          requester_id?: string;
          status?: 'pedido-realizado' | 'em-cotacao' | 'comprado-aguardando' | 'chegou-cd' | 'enviado' | 'erro-pedido' | 'finalizado';
          supplier_id?: string | null;
          total_value?: number | null;
          notes?: string | null;
          request_id?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      purchase_items: {
        Row: {
          id: string;
          purchase_id: string;
          item_id: string;
          quantity: number;
          unit_price: number | null;
          total_price: number | null;
          supplier_id: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          purchase_id: string;
          item_id: string;
          quantity: number;
          unit_price?: number | null;
          total_price?: number | null;
          supplier_id?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          purchase_id?: string;
          item_id?: string;
          quantity?: number;
          unit_price?: number | null;
          total_price?: number | null;
          supplier_id?: string | null;
          created_at?: string;
        };
      };
      suppliers: {
        Row: {
          id: string;
          name: string;
          contact_person: string | null;
          email: string | null;
          phone: string | null;
          address: string | null;
          cnpj: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          cnpj?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          contact_person?: string | null;
          email?: string | null;
          phone?: string | null;
          address?: string | null;
          cnpj?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      movements: {
        Row: {
          id: string;
          item_id: string;
          from_unit_id: string;
          to_unit_id: string;
          quantity: number;
          type: 'transfer' | 'adjustment' | 'purchase';
          reference: string | null;
          notes: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          item_id: string;
          from_unit_id: string;
          to_unit_id: string;
          quantity: number;
          type: 'transfer' | 'adjustment' | 'purchase';
          reference?: string | null;
          notes?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          item_id?: string;
          from_unit_id?: string;
          to_unit_id?: string;
          quantity?: number;
          type?: 'transfer' | 'adjustment' | 'purchase';
          reference?: string | null;
          notes?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      audit_logs: {
        Row: {
          id: string;
          user_id: string;
          action: string;
          table_name: string;
          record_id: string | null;
          old_values: any | null;
          new_values: any | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          action: string;
          table_name: string;
          record_id?: string | null;
          old_values?: any | null;
          new_values?: any | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          action?: string;
          table_name?: string;
          record_id?: string | null;
          old_values?: any | null;
          new_values?: any | null;
          created_at?: string;
        };
      };
      financial_transactions: {
        Row: {
          id: string;
          type: 'income' | 'expense';
          amount: number;
          description: string;
          unit_id: string;
          reference_type: string;
          reference_id: string | null;
          created_by: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          type: 'income' | 'expense';
          amount: number;
          description: string;
          unit_id: string;
          reference_type?: string;
          reference_id?: string | null;
          created_by: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          type?: 'income' | 'expense';
          amount?: number;
          description?: string;
          unit_id?: string;
          reference_type?: string;
          reference_id?: string | null;
          created_by?: string;
          created_at?: string;
        };
      };
      unit_budgets: {
        Row: {
          id: string;
          unit_id: string;
          budget_amount: number;
          used_amount: number;
          available_amount: number;
          period_start: string;
          period_end: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          unit_id: string;
          budget_amount?: number;
          used_amount?: number;
          period_start?: string;
          period_end?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          unit_id?: string;
          budget_amount?: number;
          used_amount?: number;
          period_start?: string;
          period_end?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      locations: {
        Row: {
          id: string;
          name: string;
          description: string | null;
          unit_id: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          description?: string | null;
          unit_id: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          description?: string | null;
          unit_id?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
};

export type Profile = Database['public']['Tables']['profiles']['Row'];
export type Unit = Database['public']['Tables']['units']['Row'];
export type Item = Database['public']['Tables']['items']['Row'];
export type Stock = Database['public']['Tables']['stock']['Row'];
export type Inventory = Database['public']['Tables']['inventory']['Row'];
export type InventoryItem = Database['public']['Tables']['inventory_items']['Row'];
export type InventoryEvent = Database['public']['Tables']['inventory_events']['Row'];
export type Request = Database['public']['Tables']['requests']['Row'];
export type RequestItem = Database['public']['Tables']['request_items']['Row'];
export type Purchase = Database['public']['Tables']['purchases']['Row'];
export type PurchaseItem = Database['public']['Tables']['purchase_items']['Row'];
export type Supplier = Database['public']['Tables']['suppliers']['Row'];
export type Movement = Database['public']['Tables']['movements']['Row'];
export type AuditLog = Database['public']['Tables']['audit_logs']['Row'];
export type FinancialTransaction = Database['public']['Tables']['financial_transactions']['Row'];
export type UnitBudget = Database['public']['Tables']['unit_budgets']['Row'];
export type Location = Database['public']['Tables']['locations']['Row'];

export type UserRole = 'admin' | 'gestor' | 'operador-financeiro' | 'operador-administrativo' | 'operador-almoxarife';
export type PurchaseStatus = 'pedido-realizado' | 'em-cotacao' | 'comprado-aguardando' | 'chegou-cd' | 'enviado' | 'erro-pedido' | 'finalizado';
export type InventoryStatus = 'available' | 'reserved' | 'damaged' | 'expired';
export type InventoryItemStatus = 'working' | 'maintenance' | 'broken' | 'disposed';
export type InventoryEventType = 'maintenance' | 'repair' | 'inspection' | 'relocation' | 'status_change' | 'other';
export type MovementType = 'transfer' | 'adjustment' | 'purchase';
export type TransactionType = 'income' | 'expense';
export type RequestStatus = 'solicitado' | 'analisando' | 'aprovado' | 'aprovado-pendente' | 'rejeitado' | 'preparando' | 'enviado' | 'recebido' | 'aprovado-unidade' | 'erro-pedido' | 'cancelado';
export type RequestPriority = 'baixa' | 'normal' | 'alta' | 'urgente';