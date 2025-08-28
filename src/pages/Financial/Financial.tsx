import React, { useEffect, useState } from 'react';
import { 
  CurrencyDollarIcon, 
  ArrowTrendingUpIcon, 
  ArrowTrendingDownIcon,
  PlusIcon,
  BanknotesIcon,
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  CalendarIcon,
  ChartBarIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { 
  getCurrentDateBrazil, 
  formatDateBrazil, 
  formatDateForDisplay,
  getFirstDayOfMonthBrazil,
  getDaysAgoBrazil,
  getDaysDifference,
  getTodayBrazilForInput
} from '../../utils/dateHelper';
import toast from 'react-hot-toast';
import IncomeForm from './IncomeForm';
import BudgetForm from './BudgetForm';
import UnitExpenseReport from './UnitExpenseReport';

interface FinancialTransaction {
  id: string;
  type: 'income' | 'expense';
  amount: number;
  description: string;
  reference_type: string;
  created_at: string;
  unit: {
    name: string;
  };
  created_by_profile: {
    name: string;
  };
}

interface UnitBudget {
  id: string;
  budget_amount: number;
  used_amount: number;
  available_amount: number;
  period_start: string;
  period_end: string;
  unit: {
    name: string;
    is_cd: boolean;
  };
}

const Financial: React.FC = () => {
  const [transactions, setTransactions] = useState<FinancialTransaction[]>([]);
  const [budgets, setBudgets] = useState<UnitBudget[]>([]);
  const [budgetAlerts, setBudgetAlerts] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [incomeModalOpen, setIncomeModalOpen] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [expenseReportOpen, setExpenseReportOpen] = useState(false);
  const [editingBudget, setEditingBudget] = useState<any>(null);
  
  // Filtros de data
  const [startDate, setStartDate] = useState(() => getDaysAgoBrazil(30));
  const [endDate, setEndDate] = useState(() => getTodayBrazilForInput());
  const [budgetPeriodFilter, setBudgetPeriodFilter] = useState(() => {
    const today = getTodayBrazilForInput();
    console.log('💰 Initial budgetPeriodFilter:', today);
    return today;
  });

  const permissions = usePermissions();

  useEffect(() => {
    fetchFinancialData();
  }, [startDate, endDate, budgetPeriodFilter]);

  const fetchFinancialData = async () => {
    try {
      const [transactionsResult, budgetsResult, unitsResult] = await Promise.all([
        // Buscar transações no período selecionado
        supabase
          .from('financial_transactions')
          .select(`
            *,
            unit:units(name),
            created_by_profile:profiles!financial_transactions_created_by_fkey(name)
          `)
          .gte('created_at', startDate + 'T00:00:00')
          .lte('created_at', endDate + 'T23:59:59')
          .order('created_at', { ascending: false }),
        
        // Buscar todos os orçamentos que se sobrepõem ao período selecionado
        supabase
          .from('unit_budgets')
          .select(`
            *,
            unit:units(name, is_cd)
          `)
          .lte('period_start', budgetPeriodFilter)
          .gte('period_end', budgetPeriodFilter)
          .order('created_at', { ascending: false }),

        // Buscar todas as unidades para verificar quais não têm orçamento
        supabase
          .from('units')
          .select('id, name')
          .order('name')
      ]);

      if (transactionsResult.error) throw transactionsResult.error;
      if (budgetsResult.error) throw budgetsResult.error;
      if (unitsResult.error) throw unitsResult.error;

      setTransactions(transactionsResult.data || []);
      
      // Agrupar orçamentos por unidade e somar valores
      const budgetsByUnit = (budgetsResult.data || []).reduce((acc, budget) => {
        const unitId = budget.unit_id;
        if (!acc[unitId]) {
          acc[unitId] = {
            id: budget.id, // Usar o ID do primeiro orçamento encontrado
            unit_id: unitId,
            unit: budget.unit,
            budget_amount: 0,
            used_amount: 0,
            available_amount: 0,
            period_start: budget.period_start,
            period_end: budget.period_end,
            created_at: budget.created_at,
            updated_at: budget.updated_at
          };
        }
        
        // Somar valores dos orçamentos
        acc[unitId].budget_amount += budget.budget_amount;
        acc[unitId].used_amount += budget.used_amount;
        acc[unitId].available_amount += budget.available_amount;
        
        // Usar as datas mais amplas (menor start, maior end)
        if (budget.period_start < acc[unitId].period_start) {
          acc[unitId].period_start = budget.period_start;
        }
        if (budget.period_end > acc[unitId].period_end) {
          acc[unitId].period_end = budget.period_end;
        }
        
        return acc;
      }, {} as Record<string, any>);
      
      // Converter de volta para array e ordenar por nome da unidade
      const sortedBudgets = Object.values(budgetsByUnit).sort((a, b) => 
        a.unit?.name?.localeCompare(b.unit?.name || '') || 0
      );
      setBudgets(sortedBudgets);

      // Verificar alertas de orçamento para a data selecionada
      const alerts: string[] = [];
      const unitsWithBudget = new Set(sortedBudgets.map(b => b.unit_id));
      const allUnits = unitsResult.data || [];

      // Verificar unidades sem orçamento no período selecionado
      allUnits.forEach(unit => {
        if (!unitsWithBudget.has(unit.id)) {
          alerts.push(`Unidade "${unit.name}" não possui orçamento definido para a data ${formatDateForDisplay(budgetPeriodFilter)}`);
        }
      });

      // Verificar orçamentos próximos do vencimento (próximos 7 dias da data selecionada)
      const selectedDateBrazil = new Date(budgetPeriodFilter + 'T12:00:00-03:00');
      
      // Log para debug do período de orçamento
      console.log('💰 Budget period analysis:', {
        budgetPeriodFilter,
        selectedDateBrazil: selectedDateBrazil.toISOString(),
        selectedDateBrazilFormatted: selectedDateBrazil.toLocaleDateString('pt-BR'),
        budgetsCount: sortedBudgets.length
      });

      sortedBudgets.forEach(budget => {
        const endDate = new Date(budget.period_end + 'T12:00:00-03:00');
        
        const daysUntilExpiry = getDaysDifference(budgetPeriodFilter, budget.period_end);
        
        // Log para debug de cada orçamento
        console.log(`💰 Budget ${budget.unit?.name}:`, {
          period_end: budget.period_end,
          endDate: endDate.toISOString(),
          daysUntilExpiry,
          selectedDate: budgetPeriodFilter
        });
          
        if (endDate >= selectedDateBrazil && daysUntilExpiry <= 7) {
          alerts.push(
            `Orçamento da unidade "${budget.unit?.name}" expira em ${daysUntilExpiry} dia(s) a partir da data selecionada`
          );
        }
      });

      setBudgetAlerts(alerts);
    } catch (error) {
      console.error('Error fetching financial data:', error);
      toast.error('Erro ao carregar dados financeiros');
    } finally {
      setLoading(false);
    }
  };

  const handleDataSaved = () => {
    fetchFinancialData();
    setIncomeModalOpen(false);
    setBudgetModalOpen(false);
    setExpenseReportOpen(false);
    setEditingBudget(null);
  };

  const handleDeleteBudget = async (id: string) => {
    if (window.confirm('Tem certeza que deseja excluir este orçamento?')) {
      try {
        const { error } = await supabase
          .from('unit_budgets')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setBudgets(budgets.filter(budget => budget.id !== id));
        toast.success('Orçamento excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting budget:', error);
        toast.error('Erro ao excluir orçamento');
      }
    }
  };

  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + t.amount, 0);

  const totalBudget = budgets.reduce((sum, b) => sum + b.budget_amount, 0);
  const totalUsed = budgets.reduce((sum, b) => sum + b.used_amount, 0);
  const totalAvailable = budgets.reduce((sum, b) => sum + b.available_amount, 0);

  const transactionColumns = [
    {
      key: 'type',
      title: 'Tipo',
      render: (value: string) => (
        <div className={`flex items-center ${value === 'income' ? 'text-success-600' : 'text-error-600'}`}>
          {value === 'income' ? (
            <ArrowTrendingUpIcon className="w-4 h-4 mr-1" />
          ) : (
            <ArrowTrendingDownIcon className="w-4 h-4 mr-1" />
          )}
          <Badge variant={value === 'income' ? 'success' : 'error'}>
            {value === 'income' ? 'Receita' : 'Despesa'}
          </Badge>
        </div>
      )
    },
    {
      key: 'description',
      title: 'Descrição',
    },
    {
      key: 'unit',
      title: 'Unidade',
      render: (unit: any) => unit?.name || '-'
    },
    {
      key: 'amount',
      title: 'Valor',
      render: (value: number, record: FinancialTransaction) => (
        <span className={`font-medium ${record.type === 'income' ? 'text-success-600' : 'text-error-600'}`}>
          {record.type === 'income' ? '+' : '-'}R$ {Math.abs(value).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'created_by_profile',
      title: 'Criado por',
      render: (profile: any) => profile?.name || '-'
    },
    {
      key: 'created_at',
      title: 'Data',
      render: (value: string) => formatDateForDisplay(value)
    },
  ];

  const budgetColumns = [
    {
      key: 'unit',
      title: 'Unidade',
      render: (unit: any) => (
        <div className="flex items-center">
          <BuildingOffice2Icon className="w-4 h-4 mr-2 text-gray-400" />
          <div>
            <div className="font-medium">{unit?.name}</div>
            {unit?.is_cd && (
              <Badge variant="info" size="sm">CD</Badge>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'budget_amount',
      title: 'Orçamento',
      render: (value: number) => (
        <span className="font-medium text-primary-600">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'used_amount',
      title: 'Utilizado',
      render: (value: number) => (
        <span className="font-medium text-error-600">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'available_amount',
      title: 'Disponível',
      render: (value: number) => (
        <span className={`font-medium ${value > 0 ? 'text-success-600' : 'text-error-600'}`}>
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'period',
      title: 'Período',
      render: (_: any, record: UnitBudget) => {
        const daysUntilExpiry = getDaysDifference(budgetPeriodFilter, record.period_end);
        
        return (
          <div>
            <span className="text-sm text-gray-600">
              {formatDateForDisplay(record.period_start)} - {formatDateForDisplay(record.period_end)}
            </span>
            {daysUntilExpiry <= 7 && daysUntilExpiry > 0 && (
              <div className="text-xs text-warning-600 mt-1">
                ⚠️ Expira em {daysUntilExpiry} dia(s)
              </div>
            )}
            {daysUntilExpiry <= 0 && (
              <div className="text-xs text-error-600 mt-1">
                ❌ Período expirado
              </div>
            )}
          </div>
        );
      }
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: UnitBudget) => (
        <div className="flex space-x-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingBudget(record);
              setBudgetModalOpen(true);
            }}
          >
            Editar
          </Button>
          <Button
            size="sm"
            variant="danger"
            onClick={() => handleDeleteBudget(record.id)}
          >
            Excluir
          </Button>
        </div>
      ),
    },
  ];

  if (!permissions.canAccessFinancial) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar o módulo financeiro.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Financeiro</h1>
          <p className="mt-1 text-sm text-gray-600">
            Controle financeiro, receitas e orçamentos por unidade
          </p>
        </div>
        <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
          <Button
            onClick={() => setIncomeModalOpen(true)}
            className="w-full sm:w-auto"
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Adicionar Receita
          </Button>
          <Button
            variant="secondary"
            onClick={() => {
              setEditingBudget(null);
              setBudgetModalOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <BanknotesIcon className="w-4 h-4 mr-2" />
            Gerenciar Orçamentos
          </Button>
          <Button
            variant="outline"
            onClick={() => setExpenseReportOpen(true)}
            className="w-full sm:w-auto"
          >
            <ChartBarIcon className="w-4 h-4 mr-2" />
            Relatório de Gastos
          </Button>
        </div>
      </div>

      {/* Filtros de Data */}
      <Card>
        <div className="flex items-center mb-4">
          <CalendarIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros de Período</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial (Transações)
            </label>
            <input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Final (Transações)
            </label>
            <input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="budget_period" className="block text-sm font-medium text-gray-700 mb-1">
              Data de Referência (Orçamentos)
            </label>
            <input
              id="budget_period"
              type="date"
              value={budgetPeriodFilter}
              onChange={(e) => setBudgetPeriodFilter(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
            <p className="mt-1 text-xs text-gray-500">
              Mostra orçamentos válidos para esta data
            </p>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              setStartDate(getDaysAgoBrazil(30));
              setEndDate(today);
              setBudgetPeriodFilter(today);
            }}
          >
            Último Mês
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              setStartDate(getFirstDayOfMonthBrazil());
              setEndDate(today);
              setBudgetPeriodFilter(today);
            }}
          >
            Mês Atual
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              const brazilDate = getCurrentDateBrazil();
              const firstDayOfYear = new Date(brazilDate.getFullYear(), 0, 1);
              setStartDate(formatDateBrazil(firstDayOfYear));
              setEndDate(today);
              setBudgetPeriodFilter(today);
            }}
          >
            Ano Atual
          </Button>
        </div>
      </Card>

      {/* Alertas de Orçamento */}
      {budgetAlerts.length > 0 && (
        <Card className="border-warning-200 bg-warning-50">
          <div className="flex items-start">
            <ExclamationTriangleIcon className="h-5 w-5 text-warning-600 mt-0.5 mr-3 flex-shrink-0" />
            <div className="flex-1">
              <h3 className="text-sm font-medium text-warning-800 mb-2">
                Alertas de Orçamento - {new Date(budgetPeriodFilter).toLocaleDateString('pt-BR')}
              </h3>
              <ul className="text-sm text-warning-700 space-y-1">
                {budgetAlerts.map((alert, index) => (
                  <li key={index} className="flex items-start">
                    <span className="mr-2">•</span>
                    <span>{alert}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </Card>
      )}

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                <ArrowTrendingUpIcon className="w-5 h-5 text-success-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Receitas (Período)</p>
              <p className="text-lg font-semibold text-success-600">
                R$ {totalIncome.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-error-100 rounded-full flex items-center justify-center">
                <ArrowTrendingDownIcon className="w-5 h-5 text-error-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Despesas (Período)</p>
              <p className="text-lg font-semibold text-error-600">
                R$ {totalExpenses.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <BanknotesIcon className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Orçamento Total</p>
              <p className="text-lg font-semibold text-primary-600">
                R$ {totalBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <CurrencyDollarIcon className="w-5 h-5 text-warning-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Disponível Total</p>
              <p className={`text-lg font-semibold ${totalAvailable >= 0 ? 'text-success-600' : 'text-error-600'}`}>
                R$ {totalAvailable.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>
      </div>

      {/* Orçamentos por Unidade */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">
              Orçamentos por Unidade - {formatDateForDisplay(new Date(budgetPeriodFilter + 'T12:00:00-03:00'))}
            </h3>
            <p className="text-sm text-gray-500">
              Orçamentos válidos para a data de referência selecionada
            </p>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditingBudget(null);
              setBudgetModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-1" />
            Novo Orçamento
          </Button>
        </div>
        <Table
          columns={budgetColumns}
          data={budgets}
          loading={loading}
          emptyMessage={`Nenhum orçamento encontrado para a data ${formatDateForDisplay(budgetPeriodFilter)}`}
          emptyMessage={`Nenhum orçamento encontrado para a data ${formatDateForDisplay(new Date(budgetPeriodFilter + 'T12:00:00-03:00'))}`}
        />
      </Card>

      {/* Transações Financeiras */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <div>
            <h3 className="text-lg font-medium text-gray-900">Transações Financeiras</h3>
            <p className="text-sm text-gray-500">
              Período: {formatDateForDisplay(startDate)} até {formatDateForDisplay(endDate)}
            </p>
          </div>
        </div>
        <Table
          columns={transactionColumns}
          data={transactions}
          loading={loading}
          emptyMessage="Nenhuma transação encontrada no período selecionado"
        />
      </Card>

      {/* Modal de Receita */}
      <Modal
        isOpen={incomeModalOpen}
        onClose={() => setIncomeModalOpen(false)}
        title="Adicionar Receita"
        size="lg"
      >
        <IncomeForm
          onSave={handleDataSaved}
          onCancel={() => setIncomeModalOpen(false)}
        />
      </Modal>

      {/* Modal de Orçamento */}
      <Modal
        isOpen={budgetModalOpen}
        onClose={() => {
          setBudgetModalOpen(false);
          setEditingBudget(null);
        }}
        title={editingBudget ? 'Editar Orçamento' : 'Novo Orçamento'}
        size="lg"
      >
        <BudgetForm
          budget={editingBudget}
          onSave={handleDataSaved}
          onCancel={() => {
            setBudgetModalOpen(false);
            setEditingBudget(null);
          }}
        />
      </Modal>

      {/* Modal de Relatório de Gastos */}
      <Modal
        isOpen={expenseReportOpen}
        onClose={() => setExpenseReportOpen(false)}
        title="Relatório de Gastos por Unidade"
        size="xl"
      >
        <UnitExpenseReport
          onClose={() => setExpenseReportOpen(false)}
        />
      </Modal>
    </div>
  );
};

export default Financial;