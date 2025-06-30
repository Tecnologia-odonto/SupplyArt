import React from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface UnitFormProps {
  unit?: Unit | null;
  onSave: (unit: Unit) => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  description: string;
  address: string;
  is_cd: boolean;
}

const UnitForm: React.FC<UnitFormProps> = ({ unit, onSave, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: unit?.name || '',
      description: unit?.description || '',
      address: unit?.address || '',
      is_cd: unit?.is_cd || false,
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const unitData = {
        name: data.name,
        description: data.description || null,
        address: data.address || null,
        is_cd: data.is_cd,
      };

      let result;
      if (unit) {
        result = await supabase
          .from('units')
          .update(unitData)
          .eq('id', unit.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('units')
          .insert(unitData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      onSave(result.data);
      toast.success(unit ? 'Unidade atualizada com sucesso!' : 'Unidade criada com sucesso!');
    } catch (error: any) {
      console.error('Error saving unit:', error);
      toast.error(error.message || 'Erro ao salvar unidade');
    }
  };

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome *
          </label>
          <input
            id="name"
            type="text"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.name ? 'border-error-300' : ''
            }`}
            {...register('name', { required: 'Nome é obrigatório' })}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-error-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('description')}
          />
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Endereço
          </label>
          <textarea
            id="address"
            rows={2}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('address')}
          />
        </div>

        <div className="flex items-center">
          <input
            id="is_cd"
            type="checkbox"
            className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
            {...register('is_cd')}
          />
          <label htmlFor="is_cd" className="ml-2 block text-sm text-gray-900">
            É um Centro de Distribuição
          </label>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {unit ? 'Atualizar' : 'Criar'} Unidade
          </Button>
        </div>
      </form>
    </div>
  );
};

export default UnitForm;