import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
import Button from '../../components/UI/Button';
import { getTodayBrazilForInput } from '../../utils/dateHelper';
import toast from 'react-hot-toast';

interface BudgetFormProps {
  budget?: any;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  unit_id: string;
  budget_amount: number;
  period_start: string;
  period_end: string;
}

// Componente de input de moeda estilo calculadora
const CurrencyInput: React.FC<{
  value: number;
  onChange: (value: number) => void;
  placeholder?: string;
  disabled?: boolean;
  error?: boolean;
}> = ({ value, onChange, placeholder, disabled, error }) => {
  const [displayValue, setDisplayValue] = useState('');
  const [rawValue, setRawValue] = useState(0);

  useEffect(() => {
    if (value > 0) {
      setRawValue(Math.round(value * 100));
      setDisplayValue(formatCurrency(Math.round(value * 100)));
    }
  }, [value]);

  const formatCurrency = (cents: number) => {
    const reais = Math.floor(cents / 100);
    const centavos = cents % 100;
    return `R$ ${reais.toLocaleString('pt-BR')},${centavos.toString().padStart(2, '0')}`;
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Permitir apenas números, backspace, delete, tab, enter
    if (!/[0-9]/.test(e.key) && !['Backspace', 'Delete', 'Tab', 'Enter', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
      e.preventDefault();
      return;
    }

    if (e.key >= '0' && e.key <= '9') {
      e.preventDefault();
      const digit = parseInt(e.key);
      const newRawValue = rawValue * 10 + digit;
      
      // Limitar a 999.999.999,99 (9 dígitos antes da vírgula)
      if (newRawValue <= 99999999999) {
        setRawValue(newRawValue);
        setDisplayValue(formatCurrency(newRawValue));
        onChange(newRawValue / 100);
      }
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      const newRawValue = Math.floor(rawValue / 10);
      setRawValue(newRawValue);
      setDisplayValue(newRawValue > 0 ? formatCurrency(newRawValue) : '');
      onChange(newRawValue / 100);
    }
  };

  const handleFocus = () => {
    if (rawValue === 0) {
      setDisplayValue('');
    }
  };

  const handleBlur = () => {
    if (rawValue === 0) {
      setDisplayValue('');
    } else {
      setDisplayValue(formatCurrency(rawValue));
    }
  };

  return (
    <input
      type="text"
      value={displayValue}
      onKeyDown={handleKeyDown}
      onFocus={handleFocus}
      onBlur={handleBlur}
      placeholder={placeholder || "R$ 0,00"}
      disabled={disabled}
      className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
        error ? 'border-error-300' : ''
      } ${disabled ? 'bg-gray-100' : ''}`}
      readOnly
    />
  );
};
const BudgetForm: React.FC<BudgetFormProps> = ({ budget, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [budgetAmount, setBudgetAmount] = useState(budget?.budget_amount || 0);
  const [validating, setValidating] = useState(false);

  const { register, handleSubmit, setValue, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      unit_id: budget?.unit_id || '',
      budget_amount: budget?.budget_amount || 0,
      period_start: budget?.period_start || new Date().toISOString().split('T')[0],
      period_end: budget?.period_end || (() => {
        const today = new Date();
        const nextYear = new Date(today.getFullYear() + 1, today.getMonth(), today.getDate());
        return nextYear.toISOString().split('T')[0];
      })(),
    }
  });

  // Atualizar o valor no formulário quando o budgetAmount mudar
  useEffect(() => {
    setValue('budget_amount', budgetAmount);
  }, [budgetAmount, setValue]);
  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast.error('Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };

  const validatePeriodOverlap = async (unitId: string, startDate: string, endDate: string) => {
    try {
      setValidating(true);
      
      // Buscar orçamentos existentes para esta unidade que se sobrepõem ao período
      const { data: existingBudgets, error } = await supabase
        .from('unit_budgets')
        .select('id, period_start, period_end, budget_amount')
        .eq('unit_id', unitId)
        .or(`and(period_start.lte.${endDate},period_end.gte.${startDate})`);

      if (error) throw error;

      // Se estiver editando, ignorar o próprio orçamento
      const overlappingBudgets = existingBudgets?.filter(existingBudget => {
        if (budget && existingBudget.id === budget.id) {
          return false; // Ignorar o próprio orçamento na edição
        }
        return true;
      }) || [];

      if (overlappingBudgets.length > 0) {
        const overlappingBudget = overlappingBudgets[0];
        const overlappingStart = new Date(overlappingBudget.period_start + 'T12:00:00').toLocaleDateString('pt-BR');
        const overlappingEnd = new Date(overlappingBudget.period_end + 'T12:00:00').toLocaleDateString('pt-BR');
        const overlappingAmount = overlappingBudget.budget_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 });
        
        toast.error(
          `❌ Já existe um orçamento para esta unidade no período de ${overlappingStart} até ${overlappingEnd} (R$ ${overlappingAmount}). ` +
          `Não é possível criar orçamentos com períodos sobrepostos.`
        );
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error validating period overlap:', error);
      toast.error('Erro ao validar período do orçamento');
      return false;
    } finally {
      setValidating(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    // Validar se as datas são válidas
    if (new Date(data.period_start) >= new Date(data.period_end)) {
      toast.error('A data de início deve ser anterior à data de fim');
      return;
    }

    // Validar sobreposição de períodos
    const isValidPeriod = await validatePeriodOverlap(data.unit_id, data.period_start, data.period_end);
    if (!isValidPeriod) {
      return; // Erro já foi mostrado na validação
    }

    try {
      const budgetData = {
        unit_id: data.unit_id,
        budget_amount: budgetAmount,
        period_start: data.period_start,
        period_end: data.period_end,
      };

      console.log('💰 Saving budget with data:', budgetData);

      let result;
      if (budget) {
        result = await supabase
          .from('unit_budgets')
          .update(budgetData)
          .eq('id', budget.id);
      } else {
        result = await supabase
          .from('unit_budgets')
          .insert(budgetData);
      }

      if (result.error) throw result.error;

      onSave();
      toast.success(budget ? 'Orçamento atualizado com sucesso!' : 'Orçamento criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving budget:', error);
      if (error.code === '23505') {
        toast.error('Já existe um orçamento para esta unidade no período especificado');
      } else {
        toast.error(error.message || 'Erro ao salvar orçamento');
      }
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">💰 Como usar o campo de valor</h4>
        <div className="text-xs text-blue-700 space-y-1">
          <p><strong>Digite apenas números:</strong> 123456 = R$ 1.234,56</p>
          <p><strong>Backspace:</strong> Remove o último dígito da direita</p>
          <p><strong>Exemplo:</strong> Para R$ 5.000,00 digite: 500000</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700">
            Unidade *
          </label>
          <select
            id="unit_id"
            disabled={!!budget}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.unit_id ? 'border-error-300' : ''
            } ${budget ? 'bg-gray-100' : ''}`}
            {...register('unit_id', { required: 'Unidade é obrigatória' })}
          >
            <option value="">Selecione uma unidade</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name}
              </option>
            ))}
          </select>
          {errors.unit_id && (
            <p className="mt-1 text-sm text-error-600">{errors.unit_id.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="budget_amount" className="block text-sm font-medium text-gray-700">
            Valor do Orçamento (R$) *
          </label>
          <CurrencyInput
            value={budgetAmount}
            onChange={setBudgetAmount}
            placeholder="R$ 0,00"
            error={!!errors.budget_amount}
          />
          {errors.budget_amount && (
            <p className="mt-1 text-sm text-error-600">{errors.budget_amount.message}</p>
          )}
          {budgetAmount > 0 && (
            <p className="mt-1 text-xs text-green-600">
              ✅ Valor: R$ {budgetAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="period_start" className="block text-sm font-medium text-gray-700">
              Início do Período *
            </label>
            <input
              id="period_start"
              type="date"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.period_start ? 'border-error-300' : ''
              }`}
              {...register('period_start', { required: 'Data de início é obrigatória' })}
            />
            {errors.period_start && (
              <p className="mt-1 text-sm text-error-600">{errors.period_start.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="period_end" className="block text-sm font-medium text-gray-700">
              Fim do Período *
            </label>
            <input
              id="period_end"
              type="date"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.period_end ? 'border-error-300' : ''
              }`}
              {...register('period_end', { required: 'Data de fim é obrigatória' })}
            />
            {errors.period_end && (
              <p className="mt-1 text-sm text-error-600">{errors.period_end.message}</p>
            )}
          </div>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            loading={isSubmitting || validating}
            disabled={budgetAmount <= 0}
          >
            {validating ? 'Validando...' : budget ? 'Atualizar' : 'Criar'} Orçamento
          </Button>
        </div>
      </form>
    </div>
  );
};

export default BudgetForm;