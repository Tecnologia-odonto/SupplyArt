import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  HomeIcon, 
  BuildingOffice2Icon, 
  CubeIcon, 
  ArchiveBoxIcon, 
  ClipboardDocumentListIcon,
  ClipboardDocumentCheckIcon,
  ShoppingCartIcon,
  CurrencyDollarIcon,
  ArrowsRightLeftIcon,
  DocumentTextIcon,
  UsersIcon,
  TruckIcon,
  MapPinIcon,
  UserCircleIcon,
  XMarkIcon,
  CogIcon,
  ChevronDownIcon,
  ChevronRightIcon,
  ClipboardDocumentIcon
} from '@heroicons/react/24/outline';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';

interface SidebarProps {
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ onClose }) => {
  const permissions = usePermissions();
  const { profile } = useAuth();
  const [configurationsOpen, setConfigurationsOpen] = React.useState(false);

  const navigation = [
    { name: 'Dashboard', href: '/', icon: HomeIcon, show: true },
    { name: 'Meu Perfil', href: '/profile', icon: UserCircleIcon, show: true },
    { name: 'Estoque', href: '/stock', icon: ArchiveBoxIcon, show: permissions.canAccessInventory },
    { name: 'Estoque CD', href: '/cd-stock', icon: BuildingOffice2Icon, show: permissions.canAccessCDStock },
    { name: 'Em Rota', href: '/em-rota', icon: TruckIcon, show: permissions.canRead },
    { name: 'Inventário', href: '/inventory', icon: ClipboardDocumentListIcon, show: permissions.canAccessInventory },
    { name: 'Pedidos', href: '/requests', icon: ClipboardDocumentCheckIcon, show: permissions.canAccessRequests },
    { name: 'Compras', href: '/purchases', icon: ShoppingCartIcon, show: permissions.canAccessPurchases },
    { name: 'Cotações', href: '/quotations', icon: ClipboardDocumentIcon, show: permissions.canAccessQuotations },
    { name: 'Financeiro', href: '/financial', icon: CurrencyDollarIcon, show: permissions.canAccessFinancial },
    { name: 'Movimentações', href: '/movements', icon: ArrowsRightLeftIcon, show: permissions.canAccessMovements },
    { name: 'Usuários', href: '/users', icon: UsersIcon, show: permissions.canManageUsers },
  ];

  const configurationItems = [
    { name: 'Unidades', href: '/units', icon: BuildingOffice2Icon, show: permissions.canRead },
    { name: 'Itens', href: '/items', icon: CubeIcon, show: permissions.canAccessItems },
    { name: 'Localizações', href: '/locations', icon: MapPinIcon, show: permissions.canRead },
    { name: 'Fornecedores', href: '/suppliers', icon: TruckIcon, show: permissions.canAccessFinancial },
    { name: 'Logs de Auditoria', href: '/logs', icon: DocumentTextIcon, show: permissions.canAccessLogs },
  ];

  const hasConfigurationAccess = configurationItems.some(item => item.show);
  return (
    <div className="flex flex-col h-full bg-white">
      {/* Header */}
      <div className="flex items-center justify-between h-16 px-4 bg-primary-600">
        <h1 className="text-lg sm:text-xl font-bold text-white">SupplyArt</h1>
        {onClose && (
          <button
            onClick={onClose}
            className="lg:hidden p-1 rounded-md text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-white"
          >
            <XMarkIcon className="h-6 w-6" />
          </button>
        )}
      </div>
      
      {/* User info */}
      <div className="flex items-center px-4 py-4 border-b border-gray-200">
        <div className="flex-shrink-0">
          <div className="h-10 w-10 rounded-full bg-primary-100 flex items-center justify-center">
            <span className="text-sm font-medium text-primary-700">
              {profile?.name?.charAt(0).toUpperCase()}
            </span>
          </div>
        </div>
        <div className="ml-3 min-w-0 flex-1">
          <p className="text-sm font-medium text-gray-700 truncate">{profile?.name}</p>
          <p className="text-xs text-gray-500 capitalize truncate">
            {profile?.role?.replace('-', ' ')}
          </p>
        </div>
      </div>
      
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-4">
        <div className="px-2 space-y-1">
          {navigation
            .filter(item => item.show)
            .map((item) => (
              <NavLink
                key={item.name}
                to={item.href}
                onClick={onClose}
                className={({ isActive }) =>
                  `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-100 text-primary-900'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon
                  className="mr-3 h-5 w-5 flex-shrink-0"
                  aria-hidden="true"
                />
                <span className="truncate">{item.name}</span>
              </NavLink>
            ))}
        </div>
      </nav>
      
      {/* Configurações submenu */}
      {hasConfigurationAccess && (
        <div className="px-2 pb-4">
          <button
            onClick={() => setConfigurationsOpen(!configurationsOpen)}
            className="group flex items-center w-full px-2 py-2 text-sm font-medium rounded-md text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors duration-200"
          >
            <CogIcon className="mr-3 h-5 w-5 flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 text-left truncate">Configurações</span>
            {configurationsOpen ? (
              <ChevronDownIcon className="h-4 w-4 flex-shrink-0" />
            ) : (
              <ChevronRightIcon className="h-4 w-4 flex-shrink-0" />
            )}
          </button>
          
          {configurationsOpen && (
            <div className="mt-1 ml-6 space-y-1">
              {configurationItems
                .filter(item => item.show)
                .map((item) => (
                  <NavLink
                    key={item.name}
                    to={item.href}
                    onClick={onClose}
                    className={({ isActive }) =>
                      `group flex items-center px-2 py-2 text-sm font-medium rounded-md transition-colors duration-200 ${
                        isActive
                          ? 'bg-primary-100 text-primary-900'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                      }`
                    }
                  >
                    <item.icon
                      className="mr-3 h-4 w-4 flex-shrink-0"
                      aria-hidden="true"
                    />
                    <span className="truncate">{item.name}</span>
                  </NavLink>
                ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Sidebar;