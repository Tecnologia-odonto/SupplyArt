import React, { useEffect, useState } from 'react';
import { ChartBarIcon, CalendarIcon, FunnelIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { 
  getTodayBrazilForInput, 
  getDaysAgoBrazil, 
  getFirstDayOfMonthBrazil,
  formatDateForDisplay 
} from '../../utils/dateHelper';
import toast from 'react-hot-toast';

interface UnitExpenseData {
  unit_id: string;
  unit_name: string;
  item_id: string;
  item_name: string;
  item_code: string;
  item_category: string;
  total_quantity: number;
  total_cost: number;
  unit_measure: string;
  request_count: number;
}

interface UnitExpenseReportProps {
  onClose: () => void;
}

const UnitExpenseReport: React.FC<UnitExpenseReportProps> = ({ onClose }) => {
  const [expenseData, setExpenseData] = useState<UnitExpenseData[]>([]);
  const [loading, setLoading] = useState(true);
  const [startDate, setStartDate] = useState(() => getFirstDayOfMonthBrazil());
  const [endDate, setEndDate] = useState(() => getTodayBrazilForInput());
  const [selectedUnitId, setSelectedUnitId] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  const [units, setUnits] = useState<any[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const { profile } = useAuth();

  useEffect(() => {
    fetchUnits();
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchExpenseData();
  }, [startDate, endDate, selectedUnitId, selectedCategory]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .eq('is_cd', false)
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchCategories = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('category')
        .not('category', 'is', null);

      if (error) throw error;
      
      const uniqueCategories = [...new Set(data?.map(item => item.category).filter(Boolean))];
      setCategories(uniqueCategories);
    } catch (error) {
      console.error('Error fetching categories:', error);
    }
  };

  const fetchExpenseData = async () => {
    try {
      setLoading(true);

      // Buscar pedidos aprovados no período com consumo de orçamento
      let query = supabase
        .from('requests')
        .select(`
          id,
          requesting_unit_id,
          total_estimated_cost,
          budget_consumption_date,
          requesting_unit:units!requests_requesting_unit_id_fkey(name),
          request_items:request_items(
            item_id,
            quantity_requested,
            estimated_unit_price,
            estimated_total_price,
            item:items(name, code, category, unit_measure)
          )
        `)
        .eq('budget_consumed', true)
        .not('budget_consumption_date', 'is', null)
        .gte('budget_consumption_date', startDate + 'T00:00:00')
        .lte('budget_consumption_date', endDate + 'T23:59:59');

      // Filtrar por unidade se selecionada
      if (selectedUnitId) {
        query = query.eq('requesting_unit_id', selectedUnitId);
      }

      // Se for gestor ou operador administrativo, filtrar por sua unidade
      if (profile?.role === 'gestor' && profile.unit_id) {
        query = query.eq('requesting_unit_id', profile.unit_id);
      } else if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        query = query.eq('requesting_unit_id', profile.unit_id);
      }

      const { data: requestsData, error } = await query;

      if (error) throw error;

      // Processar dados para agrupar por unidade e item
      const expenseMap = new Map<string, UnitExpenseData>();

      requestsData?.forEach(request => {
        request.request_items?.forEach(requestItem => {
          // Filtrar por categoria se selecionada
          if (selectedCategory && requestItem.item.category !== selectedCategory) {
            return;
          }

          const key = `${request.requesting_unit_id}-${requestItem.item_id}`;
          
          if (expenseMap.has(key)) {
            const existing = expenseMap.get(key)!;
            existing.total_quantity += requestItem.quantity_requested;
            existing.total_cost += requestItem.estimated_total_price;
            existing.request_count += 1;
          } else {
            expenseMap.set(key, {
              unit_id: request.requesting_unit_id,
              unit_name: request.requesting_unit.name,
              item_id: requestItem.item_id,
              item_name: requestItem.item.name,
              item_code: requestItem.item.code,
              item_category: requestItem.item.category || 'Sem categoria',
              total_quantity: requestItem.quantity_requested,
              total_cost: requestItem.estimated_total_price,
              unit_measure: requestItem.item.unit_measure,
              request_count: 1,
            });
          }
        });
      });

      const sortedData = Array.from(expenseMap.values()).sort((a, b) => {
        // Ordenar por unidade, depois por custo total (maior primeiro)
        if (a.unit_name !== b.unit_name) {
          return a.unit_name.localeCompare(b.unit_name);
        }
        return b.total_cost - a.total_cost;
      });

      setExpenseData(sortedData);
    } catch (error) {
      console.error('Error fetching expense data:', error);
      toast.error('Erro ao carregar relatório de gastos');
    } finally {
      setLoading(false);
    }
  };

  const columns = [
    {
      key: 'unit_name',
      title: 'Unidade',
      render: (value: string) => (
        <div className="font-medium text-gray-900">{value}</div>
      )
    },
    {
      key: 'item_name',
      title: 'Item',
      render: (value: string, record: UnitExpenseData) => (
        <div>
          <div className="font-medium">{value}</div>
          <div className="text-sm text-gray-500">{record.item_code}</div>
          <Badge variant="info" size="sm">{record.item_category}</Badge>
        </div>
      )
    },
    {
      key: 'total_quantity',
      title: 'Quantidade Total',
      render: (value: number, record: UnitExpenseData) => (
        <span>{value} {record.unit_measure}</span>
      )
    },
    {
      key: 'total_cost',
      title: 'Custo Total',
      render: (value: number) => (
        <span className="font-medium text-error-600">
          R$ {value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </span>
      )
    },
    {
      key: 'request_count',
      title: 'Nº de Pedidos',
      render: (value: number) => (
        <Badge variant="default">{value}</Badge>
      )
    },
  ];

  // Calcular totais
  const totalCost = expenseData.reduce((sum, item) => sum + item.total_cost, 0);
  const totalRequests = expenseData.reduce((sum, item) => sum + item.request_count, 0);
  
  // Agrupar por unidade para resumo
  const unitSummary = expenseData.reduce((acc, item) => {
    if (!acc[item.unit_id]) {
      acc[item.unit_id] = {
        unit_name: item.unit_name,
        total_cost: 0,
        item_count: 0,
      };
    }
    acc[item.unit_id].total_cost += item.total_cost;
    acc[item.unit_id].item_count += 1;
    return acc;
  }, {} as Record<string, any>);

  // Agrupar por categoria para resumo
  const categorySummary = expenseData.reduce((acc, item) => {
    if (!acc[item.item_category]) {
      acc[item.item_category] = {
        total_cost: 0,
        item_count: 0,
      };
    }
    acc[item.item_category].total_cost += item.total_cost;
    acc[item.item_category].item_count += 1;
    return acc;
  }, {} as Record<string, any>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-xl font-semibold text-gray-900">Relatório de Gastos por Unidade</h2>
          <p className="text-sm text-gray-600">
            Consumo de orçamento por item e categoria no período selecionado
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Fechar Relatório
        </Button>
      </div>

      {/* Filtros */}
      <Card>
        <div className="flex items-center mb-4">
          <FunnelIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros do Relatório</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
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
              Data Final
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
            <label htmlFor="unit_filter" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade
            </label>
            <select
              id="unit_filter"
              value={selectedUnitId}
              onChange={(e) => setSelectedUnitId(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todas as unidades</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label htmlFor="category_filter" className="block text-sm font-medium text-gray-700 mb-1">
              Categoria
            </label>
            <select
              id="category_filter"
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todas as categorias</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              setStartDate(getFirstDayOfMonthBrazil());
              setEndDate(today);
            }}
          >
            Mês Atual
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              setStartDate(getDaysAgoBrazil(30));
              setEndDate(today);
            }}
          >
            Últimos 30 dias
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              setStartDate(getDaysAgoBrazil(7));
              setEndDate(today);
            }}
          >
            Últimos 7 dias
          </Button>
        </div>
      </Card>

      {/* Resumo Geral */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-error-100 rounded-full flex items-center justify-center">
                <ChartBarIcon className="w-5 h-5 text-error-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Gasto Total</p>
              <p className="text-lg font-semibold text-error-600">
                R$ {totalCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-sm">#</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Pedidos</p>
              <p className="text-lg font-semibold text-info-600">{totalRequests}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-sm">📦</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Itens Diferentes</p>
              <p className="text-lg font-semibold text-primary-600">{expenseData.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Resumo por Unidade */}
      {Object.keys(unitSummary).length > 0 && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumo por Unidade</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.values(unitSummary).map((summary: any, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-gray-900">{summary.unit_name}</div>
                <div className="text-lg font-semibold text-error-600">
                  R$ {summary.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-gray-500">{summary.item_count} tipos de itens</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Resumo por Categoria */}
      {Object.keys(categorySummary).length > 0 && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Resumo por Categoria</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(categorySummary).map(([category, summary]: [string, any]) => (
              <div key={category} className="bg-gray-50 rounded-lg p-4">
                <div className="font-medium text-gray-900">{category}</div>
                <div className="text-lg font-semibold text-error-600">
                  R$ {summary.total_cost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                <div className="text-sm text-gray-500">{summary.item_count} tipos de itens</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Tabela Detalhada */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Detalhamento por Item</h3>
          <div className="text-sm text-gray-500">
            Período: {formatDateForDisplay(startDate)} até {formatDateForDisplay(endDate)}
          </div>
        </div>
        <Table
          columns={columns}
          data={expenseData}
          loading={loading}
          emptyMessage="Nenhum gasto encontrado no período selecionado"
        />
      </Card>
    </div>
  );
};

export default UnitExpenseReport;