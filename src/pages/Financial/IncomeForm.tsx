import React, { useEffect, useState } from 'react';
import { getTodayBrazilForInput } from '../../utils/dateHelper';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface IncomeFormProps {
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  amount: number;
  description: string;
  unit_id: string;
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
const IncomeForm: React.FC<IncomeFormProps> = ({ onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [amount, setAmount] = useState(0);
  const { profile } = useAuth();

  const { register, handleSubmit, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      amount: 0,
      description: '',
      unit_id: ''
    }
  });

  // Atualizar o valor no formulário quando o amount mudar
  useEffect(() => {
    setValue('amount', amount);
  }, [amount, setValue]);

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

  const onSubmit = async (data: FormData) => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    if (amount <= 0) {
      toast.error('Valor deve ser maior que zero');
      return;
    }
    try {
      // Criar transação de receita
      const { error: transactionError } = await supabase
        .from('financial_transactions')
        .insert({
          type: 'income',
          amount: amount,
          description: data.description,
          unit_id: data.unit_id,
          reference_type: 'manual',
          created_by: profile.id,
        });

      if (transactionError) throw transactionError;

      // Atualizar orçamento da unidade (adicionar ao budget_amount)
      const { error: budgetError } = await supabase
        .from('unit_budgets')
        .upsert({
          unit_id: data.unit_id,
          budget_amount: amount,
          period_start: getTodayBrazilForInput(),
          period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }, {
          onConflict: 'unit_id,period_start,period_end',
          ignoreDuplicates: false
        });

      // Se não conseguiu fazer upsert, tentar update
      if (budgetError) {
        // Buscar orçamento existente
        const { data: existingBudget } = await supabase
          .from('unit_budgets')
          .select('*')
          .eq('unit_id', data.unit_id)
          .gte('period_end', getTodayBrazilForInput())
          .single();

        if (existingBudget) {
          await supabase
            .from('unit_budgets')
            .update({
              budget_amount: existingBudget.budget_amount + amount
            })
            .eq('id', existingBudget.id);
        } else {
          await supabase
            .from('unit_budgets')
            .insert({
              unit_id: data.unit_id,
              budget_amount: amount,
              period_start: getTodayBrazilForInput(),
              period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
            });
        }
      }

      onSave();
      toast.success('Receita adicionada com sucesso!');
    } catch (error: any) {
      console.error('Error saving income:', error);
      toast.error(error.message || 'Erro ao adicionar receita');
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
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.unit_id ? 'border-error-300' : ''
            }`}
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
          <label htmlFor="amount" className="block text-sm font-medium text-gray-700">
            Valor (R$) *
          </label>
          <CurrencyInput
            value={amount}
            onChange={setAmount}
            placeholder="R$ 0,00"
            error={!!errors.amount}
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-error-600">{errors.amount.message}</p>
          )}
          {amount > 0 && (
            <p className="mt-1 text-xs text-green-600">
              ✅ Valor: R$ {amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
            </p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Motivo/Descrição *
          </label>
          <textarea
            id="description"
            rows={3}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.description ? 'border-error-300' : ''
            }`}
            {...register('description', { required: 'Descrição é obrigatória' })}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-error-600">{errors.description.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            loading={isSubmitting}
            disabled={amount <= 0}
          >
            Adicionar Receita
          </Button>
        </div>
      </form>
    </div>
  );
};

export default IncomeForm;