import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
import Button from '../../components/UI/Button';
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

const BudgetForm: React.FC<BudgetFormProps> = ({ budget, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      unit_id: budget?.unit_id || '',
      budget_amount: budget?.budget_amount || 0,
      period_start: budget?.period_start || new Date().toISOString().split('T')[0],
      period_end: budget?.period_end || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }
  });

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
    try {
      const budgetData = {
        unit_id: data.unit_id,
        budget_amount: Number(data.budget_amount),
        period_start: data.period_start,
        period_end: data.period_end,
      };

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
          <input
            id="budget_amount"
            type="number"
            min="0"
            step="0.01"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.budget_amount ? 'border-error-300' : ''
            }`}
            {...register('budget_amount', { 
              required: 'Valor do orçamento é obrigatório',
              min: { value: 0, message: 'Valor deve ser maior ou igual a zero' }
            })}
          />
          {errors.budget_amount && (
            <p className="mt-1 text-sm text-error-600">{errors.budget_amount.message}</p>
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
          <Button type="submit" loading={isSubmitting}>
            {budget ? 'Atualizar' : 'Criar'} Orçamento
          </Button>
        </div>
      </form>
    </div>
  );
};

export default BudgetForm;