import React from 'react';
import { BellIcon, Bars3Icon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';

interface HeaderProps {
  onMenuClick: () => void;
}

const Header: React.FC<HeaderProps> = ({ onMenuClick }) => {
  const { signOut, profile } = useAuth();

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
          <button
            type="button"
            className="bg-white p-1 rounded-full text-gray-400 hover:text-gray-500 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
          >
            <span className="sr-only">Ver notificações</span>
            <BellIcon className="h-6 w-6" aria-hidden="true" />
          </button>

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