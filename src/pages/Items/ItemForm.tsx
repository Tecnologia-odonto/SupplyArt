import React from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types/database';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface ItemFormProps {
  item?: Item | null;
  onSave: (item: Item) => void;
  onCancel: () => void;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  unit_measure: string;
  category: string;
  show_in_company: boolean;
  has_lifecycle: boolean;
}

const ItemForm: React.FC<ItemFormProps> = ({ item, onSave, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      code: item?.code || '',
      name: item?.name || '',
      description: item?.description || '',
      unit_measure: item?.unit_measure || '',
      category: item?.category || '',
      show_in_company: item?.show_in_company ?? true,
      has_lifecycle: item?.has_lifecycle ?? false,
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const itemData = {
        code: data.code,
        name: data.name,
        description: data.description || null,
        unit_measure: data.unit_measure,
        category: data.category || null,
        show_in_company: data.show_in_company,
        has_lifecycle: data.has_lifecycle,
      };

      let result;
      if (item) {
        result = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('items')
          .insert(itemData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      onSave(result.data);
      toast.success(item ? 'Item atualizado com sucesso!' : 'Item criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving item:', error);
      toast.error(error.message || 'Erro ao salvar item');
    }
  };

  const unitMeasures = [
    'un',
    'cx',
    'kg',
    'g',
    'l',
    'ml',
    'm',
    'cm',
    'pç',
    'par',
    'dz',
  ];

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700">
              Código *
            </label>
            <input
              id="code"
              type="text"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.code ? 'border-error-300' : ''
              }`}
              {...register('code', { required: 'Código é obrigatório' })}
            />
            {errors.code && (
              <p className="mt-1 text-sm text-error-600">{errors.code.message}</p>
            )}
          </div>

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

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="unit_measure" className="block text-sm font-medium text-gray-700">
              Unidade de Medida *
            </label>
            <select
              id="unit_measure"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.unit_measure ? 'border-error-300' : ''
              }`}
              {...register('unit_measure', { required: 'Unidade de medida é obrigatória' })}
            >
              <option value="">Selecione uma unidade</option>
              {unitMeasures.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {errors.unit_measure && (
              <p className="mt-1 text-sm text-error-600">{errors.unit_measure.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Categoria
            </label>
            <input
              id="category"
              type="text"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('category')}
            />
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              id="show_in_company"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              {...register('show_in_company')}
            />
            <label htmlFor="show_in_company" className="ml-2 block text-sm text-gray-900">
              Exibir na empresa
            </label>
            <span className="ml-2 text-xs text-gray-500">
              (Determina se o item aparece na listagem de compras)
            </span>
          </div>

          <div className="flex items-center">
            <input
              id="has_lifecycle"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              {...register('has_lifecycle')}
            />
            <label htmlFor="has_lifecycle" className="ml-2 block text-sm text-gray-900">
              Tem vida útil
            </label>
            <span className="ml-2 text-xs text-gray-500">
              (Permite controle individual de cada item no inventário)
            </span>
          </div>
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Sobre o Catálogo de Itens</h4>
          <p className="text-xs text-blue-700">
            Este módulo serve como catálogo de produtos. A quantidade é controlada nos módulos de Estoque e Inventário.
            Use "Exibir na empresa" para definir quais itens aparecem nas compras.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {item ? 'Atualizar' : 'Criar'} Item
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ItemForm;