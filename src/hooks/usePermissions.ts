import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types/database';

interface Permissions {
  canCreate: boolean;
  canRead: boolean;
  canUpdate: boolean;
  canDelete: boolean;
  canManageUsers: boolean;
  canAccessFinancial: boolean;
  canAccessInventory: boolean;
  canAccessPurchases: boolean;
  canAccessMovements: boolean;
  canAccessLogs: boolean;
  canAccessAllUnits: boolean;
  canAccessItems: boolean;
  canManageSuppliers: boolean;
  canAccessRequests: boolean; // Nova permissão para módulo de pedidos
  canApproveRequests: boolean; // Permissão para aprovar pedidos (almoxarife)
  canManageUnits: boolean; // Permissão para gerenciar unidades
  canAccessCDStock: boolean; // Permissão para acessar estoque CD
}

const rolePermissions: Record<UserRole, Permissions> = {
  admin: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: true,
    canManageUsers: true,
    canAccessFinancial: true,
    canAccessInventory: true,
    canAccessPurchases: true,
    canAccessMovements: true,
    canAccessLogs: true,
    canAccessAllUnits: true,
    canAccessItems: true,
    canManageSuppliers: true,
    canAccessRequests: true,
    canApproveRequests: true,
    canManageUnits: true,
    canAccessCDStock: true,
  },
  gestor: {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canManageUsers: true,
    canAccessFinancial: true,
    canAccessInventory: true,
    canAccessPurchases: true,
    canAccessMovements: true,
    canAccessLogs: true,
    canAccessAllUnits: true,
    canAccessItems: true,
    canManageSuppliers: true,
    canAccessRequests: true,
    canApproveRequests: true,
    canManageUnits: true,
    canAccessCDStock: false,
  },
  'operador-financeiro': {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canManageUsers: false,
    canAccessFinancial: true,
    canAccessInventory: false,
    canAccessPurchases: true,
    canAccessMovements: false,
    canAccessLogs: false,
    canAccessAllUnits: false,
    canAccessItems: false,
    canManageSuppliers: false,
    canAccessRequests: true, // Pode ver pedidos
    canApproveRequests: false, // Não pode aprovar
    canManageUnits: false,
    canAccessCDStock: false,
  },
  'operador-administrativo': {
    canCreate: true,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canManageUsers: false,
    canAccessFinancial: false,
    canAccessInventory: true,
    canAccessPurchases: true,
    canAccessMovements: false,
    canAccessLogs: false,
    canAccessAllUnits: false,
    canAccessItems: false,
    canManageSuppliers: false,
    canAccessRequests: true, // Pode criar e ver seus pedidos
    canApproveRequests: false, // Não pode aprovar
    canManageUnits: false, // Não pode gerenciar unidades
    canAccessCDStock: false,
  },
  'operador-almoxarife': {
    canCreate: false,
    canRead: true,
    canUpdate: true,
    canDelete: false,
    canManageUsers: false,
    canAccessFinancial: false,
    canAccessInventory: true,
    canAccessPurchases: false,
    canAccessMovements: false,
    canAccessLogs: false,
    canAccessAllUnits: true,
    canAccessItems: true,
    canManageSuppliers: true,
    canAccessRequests: true, // Pode ver todos os pedidos
    canApproveRequests: true, // Pode aprovar/rejeitar pedidos
    canManageUnits: false,
    canAccessCDStock: true,
  },
};

export const usePermissions = () => {
  const { profile } = useAuth();

  if (!profile) {
    return {
      canCreate: false,
      canRead: false,
      canUpdate: false,
      canDelete: false,
      canManageUsers: false,
      canAccessFinancial: false,
      canAccessInventory: false,
      canAccessPurchases: false,
      canAccessMovements: false,
      canAccessLogs: false,
      canAccessAllUnits: false,
      canAccessItems: false,
      canManageSuppliers: false,
      canAccessRequests: false,
      canApproveRequests: false,
    };
  }

  return rolePermissions[profile.role];
};