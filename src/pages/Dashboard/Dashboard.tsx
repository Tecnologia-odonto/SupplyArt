import React, { useEffect, useState } from 'react';
import { 
  CubeIcon, 
  BuildingOffice2Icon, 
  ShoppingCartIcon, 
  CurrencyDollarIcon,
  ArrowTrendingUpIcon,
  ArrowTrendingDownIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { usePermissions } from '../../hooks/usePermissions';

interface DashboardStats {
  totalItems: number;
  totalUnits: number;
  pendingPurchases: number;
  monthlyExpense: number;
}

const Dashboard: React.FC = () => {
  const [stats, setStats] = useState<DashboardStats>({
    totalItems: 0,
    totalUnits: 0,
    pendingPurchases: 0,
    monthlyExpense: 0
  });
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();
  const permissions = usePermissions();

  useEffect(() => {
    fetchDashboardStats();
  }, []);

  const fetchDashboardStats = async () => {
    try {
      const [itemsResult, unitsResult, purchasesResult] = await Promise.all([
        supabase.from('items').select('id', { count: 'exact', head: true }),
        supabase.from('units').select('id', { count: 'exact', head: true }),
        supabase
          .from('purchases')
          .select('id', { count: 'exact', head: true })
          .neq('status', 'finalizado')
      ]);

      setStats({
        totalItems: itemsResult.count || 0,
        totalUnits: unitsResult.count || 0,
        pendingPurchases: purchasesResult.count || 0,
        monthlyExpense: 0 // TODO: Calculate from financial data
      });
    } catch (error) {
      console.error('Error fetching dashboard stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const statCards = [
    {
      name: 'Total de Itens',
      value: stats.totalItems,
      icon: CubeIcon,
      change: '+12%',
      changeType: 'increase',
      show: permissions.canRead
    },
    {
      name: 'Unidades',
      value: stats.totalUnits,
      icon: BuildingOffice2Icon,
      change: '+2%',
      changeType: 'increase',
      show: permissions.canRead
    },
    {
      name: 'Pedidos Pendentes',
      value: stats.pendingPurchases,
      icon: ShoppingCartIcon,
      change: '-8%',
      changeType: 'decrease',
      show: permissions.canAccessPurchases
    },
    {
      name: 'Gasto Mensal',
      value: `R$ ${stats.monthlyExpense.toLocaleString('pt-BR')}`,
      icon: CurrencyDollarIcon,
      change: '+15%',
      changeType: 'increase',
      show: permissions.canAccessFinancial
    }
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="bg-white rounded-lg shadow p-5">
                <div className="h-6 bg-gray-200 rounded w-3/4 mb-4"></div>
                <div className="h-8 bg-gray-200 rounded w-1/2"></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">
          Bem-vindo, {profile?.name}!
        </h1>
        <p className="mt-1 text-sm text-gray-600">
          Visão geral do sistema SupplyArt
        </p>
      </div>

      <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
        {statCards
          .filter(stat => stat.show)
          .map((stat) => (
            <Card key={stat.name} className="animate-slide-in">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <stat.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" aria-hidden="true" />
                </div>
                <div className="ml-3 sm:ml-5 w-0 flex-1 min-w-0">
                  <dl>
                    <dt className="text-xs sm:text-sm font-medium text-gray-500 truncate">
                      {stat.name}
                    </dt>
                    <dd className="flex items-baseline">
                      <div className="text-lg sm:text-2xl font-semibold text-gray-900 truncate">
                        {stat.value}
                      </div>
                      <div
                        className={`ml-2 flex items-baseline text-xs sm:text-sm font-semibold ${
                          stat.changeType === 'increase'
                            ? 'text-success-600'
                            : 'text-error-600'
                        }`}
                      >
                        {stat.changeType === 'increase' ? (
                          <ArrowTrendingUpIcon
                            className="self-center flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-success-500"
                            aria-hidden="true"
                          />
                        ) : (
                          <ArrowTrendingDownIcon
                            className="self-center flex-shrink-0 h-3 w-3 sm:h-4 sm:w-4 text-error-500"
                            aria-hidden="true"
                          />
                        )}
                        <span className="sr-only">
                          {stat.changeType === 'increase' ? 'Increased' : 'Decreased'} by
                        </span>
                        {stat.change}
                      </div>
                    </dd>
                  </dl>
                </div>
              </div>
            </Card>
          ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
            Atividades Recentes
          </h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-primary-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  Novo pedido de compra criado para Unidade Central
                </p>
                <span className="text-xs text-gray-400">há 5 min</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-accent-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  Estoque atualizado: Papel A4 - Filial Norte
                </p>
                <span className="text-xs text-gray-400">há 1h</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-success-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  Pedido #1234 finalizado com sucesso
                </p>
                <span className="text-xs text-gray-400">há 2h</span>
              </div>
            </div>
          </div>
        </Card>

        <Card>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-4">
            Alertas de Estoque
          </h3>
          <div className="space-y-3">
            <div className="flex items-center justify-between p-3 bg-warning-50 rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-warning-800">
                  Estoque Baixo
                </p>
                <p className="text-xs text-warning-600">
                  3 itens abaixo do limite mínimo
                </p>
              </div>
              <span className="text-warning-600 font-semibold flex-shrink-0 ml-2">!</span>
            </div>
            <div className="flex items-center justify-between p-3 bg-error-50 rounded-lg">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-error-800">
                  Itens Vencidos
                </p>
                <p className="text-xs text-error-600">
                  1 item com data de validade expirada
                </p>
              </div>
              <span className="text-error-600 font-semibold flex-shrink-0 ml-2">!</span>
            </div>
          </div>
        </Card>
      </div>
    </div>
  );
};

export default Dashboard;