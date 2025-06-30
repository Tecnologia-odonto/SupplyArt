import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Stock, Item, Unit } from '../../types/database';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface StockFormProps {
  stock?: Stock | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  item_id: string;
  unit_id: string;
  quantity: number;
  min_quantity: number;
  max_quantity: number;
  location: string;
}

const StockForm: React.FC<StockFormProps> = ({ stock, onSave, onCancel }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      item_id: stock?.item_id || '',
      unit_id: stock?.unit_id || '',
      quantity: stock?.quantity || 0,
      min_quantity: stock?.min_quantity || 0,
      max_quantity: stock?.max_quantity || 0,
      location: stock?.location || '',
    }
  });

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsResult, unitsResult] = await Promise.all([
        supabase.from('items').select('*').order('name'),
        supabase.from('units').select('*').order('name')
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (unitsResult.error) throw unitsResult.error;

      setItems(itemsResult.data || []);
      setUnits(unitsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const stockData = {
        item_id: data.item_id,
        unit_id: data.unit_id,
        quantity: Number(data.quantity),
        min_quantity: data.min_quantity ? Number(data.min_quantity) : null,
        max_quantity: data.max_quantity ? Number(data.max_quantity) : null,
        location: data.location || null,
      };

      let result;
      if (stock) {
        result = await supabase
          .from('stock')
          .update(stockData)
          .eq('id', stock.id);
      } else {
        result = await supabase
          .from('stock')
          .insert(stockData);
      }

      if (result.error) throw result.error;

      onSave();
      toast.success(stock ? 'Estoque atualizado com sucesso!' : 'Estoque criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving stock:', error);
      toast.error(error.message || 'Erro ao salvar estoque');
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
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="item_id" className="block text-sm font-medium text-gray-700">
              Item *
            </label>
            <select
              id="item_id"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.item_id ? 'border-error-300' : ''
              }`}
              {...register('item_id', { required: 'Item é obrigatório' })}
            >
              <option value="">Selecione um item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code})
                </option>
              ))}
            </select>
            {errors.item_id && (
              <p className="mt-1 text-sm text-error-600">{errors.item_id.message}</p>
            )}
          </div>

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
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Quantidade *
            </label>
            <input
              id="quantity"
              type="number"
              min="0"
              step="0.01"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.quantity ? 'border-error-300' : ''
              }`}
              {...register('quantity', { 
                required: 'Quantidade é obrigatória',
                min: { value: 0, message: 'Quantidade deve ser maior ou igual a 0' }
              })}
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-error-600">{errors.quantity.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="min_quantity" className="block text-sm font-medium text-gray-700">
              Quantidade Mínima
            </label>
            <input
              id="min_quantity"
              type="number"
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('min_quantity')}
            />
          </div>

          <div>
            <label htmlFor="max_quantity" className="block text-sm font-medium text-gray-700">
              Quantidade Máxima
            </label>
            <input
              id="max_quantity"
              type="number"
              min="0"
              step="0.01"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('max_quantity')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Localização
          </label>
          <input
            id="location"
            type="text"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('location')}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {stock ? 'Atualizar' : 'Ajustar'} Estoque
          </Button>
        </div>
      </form>
    </div>
  );
};

export default StockForm;