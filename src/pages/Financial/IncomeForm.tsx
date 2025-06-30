import React, { useEffect, useState } from 'react';
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

const IncomeForm: React.FC<IncomeFormProps> = ({ onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>();

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

    try {
      // Criar transação de receita
      const { error: transactionError } = await supabase
        .from('financial_transactions')
        .insert({
          type: 'income',
          amount: Number(data.amount),
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
          budget_amount: Number(data.amount),
          period_start: new Date().toISOString().split('T')[0],
          period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
        }, {
          onConflict: 'unit_id,period_start,period_end',
          ignoreDuplicates: false
        });

      // Se não conseguiu fazer upsert, tentar update
      if (budgetError) {
        const { error: updateError } = await supabase.rpc('increment_unit_budget', {
          p_unit_id: data.unit_id,
          p_amount: Number(data.amount)
        });

        if (updateError) {
          // Se a função não existe, fazer update manual
          const { data: existingBudget } = await supabase
            .from('unit_budgets')
            .select('*')
            .eq('unit_id', data.unit_id)
            .gte('period_end', new Date().toISOString().split('T')[0])
            .single();

          if (existingBudget) {
            await supabase
              .from('unit_budgets')
              .update({
                budget_amount: existingBudget.budget_amount + Number(data.amount)
              })
              .eq('id', existingBudget.id);
          } else {
            await supabase
              .from('unit_budgets')
              .insert({
                unit_id: data.unit_id,
                budget_amount: Number(data.amount),
                period_start: new Date().toISOString().split('T')[0],
                period_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
              });
          }
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
          <input
            id="amount"
            type="number"
            min="0.01"
            step="0.01"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.amount ? 'border-error-300' : ''
            }`}
            {...register('amount', { 
              required: 'Valor é obrigatório',
              min: { value: 0.01, message: 'Valor deve ser maior que zero' }
            })}
          />
          {errors.amount && (
            <p className="mt-1 text-sm text-error-600">{errors.amount.message}</p>
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
          <Button type="submit" loading={isSubmitting}>
            Adicionar Receita
          </Button>
        </div>
      </form>
    </div>
  );
};

export default IncomeForm;