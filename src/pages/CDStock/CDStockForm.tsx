import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { Item, Unit } from '../../types/database';
import Button from '../../components/UI/Button';
import ItemSearchInput from '../../components/UI/ItemSearchInput';
import toast from 'react-hot-toast';

interface CDStockFormProps {
  stock?: any;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  item_id: string;
  cd_unit_id: string;
  quantity: number;
  min_quantity: number;
  max_quantity: number;
  location: string;
  unit_price: number;
}

const CDStockForm: React.FC<CDStockFormProps> = ({ stock, onSave, onCancel }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [cdUnits, setCdUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      item_id: stock?.item_id || '',
      cd_unit_id: stock?.cd_unit_id || profile?.unit_id || '',
      quantity: stock?.quantity || 0,
      min_quantity: stock?.min_quantity || 0,
      max_quantity: stock?.max_quantity || 9999,
      location: stock?.location || 'Estoque CD',
      unit_price: stock?.unit_price || 0,
    }
  });

  const watchedItemId = watch('item_id');

  const watchedQuantity = watch('quantity');
  const watchedMaxQuantity = watch('max_quantity');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      const [itemsResult, cdUnitsResult] = await Promise.all([
        supabase.from('items').select('*').eq('show_in_company', true).order('name'),
        profile?.role === 'operador-almoxarife' && profile.unit_id
          ? supabase.from('units').select('*').eq('id', profile.unit_id).eq('is_cd', true)
          : supabase.from('units').select('*').eq('is_cd', true).order('name')
      ]);

      if (itemsResult.error) throw itemsResult.error;
      if (cdUnitsResult.error) throw cdUnitsResult.error;

      setItems(itemsResult.data || []);
      setCdUnits(cdUnitsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Se uma nova localização foi digitada, criar na tabela de localizações
      if (data.location && data.location !== 'Estoque CD') {
        try {
          await supabase
            .from('locations')
            .insert({
              name: data.location,
              unit_id: data.cd_unit_id,
              description: 'Criada automaticamente via estoque CD'
            });
        } catch (locationError) {
          console.warn('Warning: Could not save location to database:', locationError);
          // Continuar mesmo se não conseguir salvar a localização
        }
      }

      // Validação de quantidade máxima
      if (data.max_quantity && data.quantity > data.max_quantity) {
        toast.error(`Quantidade não pode exceder o limite máximo de ${data.max_quantity}`);
        return;
      }

      const stockData = {
        item_id: data.item_id,
        cd_unit_id: data.cd_unit_id,
        quantity: Math.floor(Number(data.quantity)), // Garantir que seja inteiro
        min_quantity: data.min_quantity ? Number(data.min_quantity) : null,
        max_quantity: data.max_quantity ? Number(data.max_quantity) : null,
        location: data.location || 'Estoque CD',
        unit_price: Number(data.unit_price),
        price_updated_by: profile?.id,
      };

      let result;
      if (stock) {
        // Atualizar estoque existente
        result = await supabase
          .from('cd_stock')
          .update(stockData)
          .eq('id', stock.id);
      } else {
        // Verificar se já existe estoque para este item neste CD
        const { data: existingStock, error: checkError } = await supabase
          .from('cd_stock')
          .select('*')
          .eq('item_id', data.item_id)
          .eq('cd_unit_id', data.cd_unit_id)
          .maybeSingle();

        if (checkError && checkError.code !== 'PGRST116') {
          throw checkError;
        }

        if (existingStock) {
          // AGRUPAR: Somar à quantidade existente ao invés de substituir
          const newQuantity = existingStock.quantity + Number(data.quantity);
          
          // Verificar se a nova quantidade seria negativa
          if (newQuantity < 0) {
            toast.error(`❌ Operação resultaria em estoque negativo! Estoque atual: ${existingStock.quantity}, tentando adicionar: ${data.quantity}`);
            return;
          }
          
          const updatedStockData = {
            ...stockData,
            quantity: newQuantity,
            // Manter configurações existentes se não foram alteradas
            min_quantity: data.min_quantity ? Number(data.min_quantity) : existingStock.min_quantity,
            max_quantity: data.max_quantity ? Number(data.max_quantity) : (existingStock.max_quantity || 9999),
            location: data.location || existingStock.location,
            unit_price: Number(data.unit_price),
            price_updated_by: profile?.id,
          };
          
          result = await supabase
            .from('cd_stock')
            .update(updatedStockData)
            .eq('id', existingStock.id);
            
          toast.success(`Quantidade adicionada! Total agora: ${newQuantity}`);
        } else {
          // Criar novo registro de estoque
          result = await supabase
            .from('cd_stock')
            .insert(stockData);
        }
      }

      if (result.error) throw result.error;

      onSave();
      toast.success(stock ? 'Estoque CD atualizado com sucesso!' : 'Estoque CD criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving CD stock:', error);
      
      // Mensagens de erro mais específicas
      if (error.code === '23505') {
        toast.error('Já existe um registro de estoque para este item neste CD');
      } else if (error.code === '42501') {
        toast.error('Você não tem permissão para realizar esta operação');
      } else {
        toast.error(error.message || 'Erro ao salvar estoque do CD');
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
        <h4 className="text-sm font-medium text-blue-800 mb-2">📦 Estoque do Centro de Distribuição</h4>
        <p className="text-xs text-blue-700">
          <strong>Agrupamento Inteligente:</strong> Se o item já existe neste CD, a quantidade será somada ao total existente.
          Este estoque será usado para atender pedidos das unidades através do fluxo: CD → Em Rota → Unidade.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="item_id" className="block text-sm font-medium text-gray-700">
              Item *
            </label>
            <div className="mt-1">
              <ItemSearchInput
                items={items}
                value={watchedItemId}
                onChange={(itemId) => setValue('item_id', itemId, { shouldValidate: true })}
                error={errors.item_id?.message}
                placeholder="Digite o nome ou código do item..."
              />
              <input
                type="hidden"
                {...register('item_id', { required: 'Item é obrigatório' })}
              />
            </div>
          </div>

          <div>
            <label htmlFor="cd_unit_id" className="block text-sm font-medium text-gray-700">
              Centro de Distribuição *
            </label>
            <select
              id="cd_unit_id"
              disabled={profile?.role === 'operador-almoxarife'}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.cd_unit_id ? 'border-error-300' : ''
              } ${profile?.role === 'operador-almoxarife' ? 'bg-gray-100' : ''}`}
              {...register('cd_unit_id', { required: 'Centro de Distribuição é obrigatório' })}
            >
              <option value="">Selecione um CD</option>
              {cdUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {errors.cd_unit_id && (
              <p className="mt-1 text-sm text-error-600">{errors.cd_unit_id.message}</p>
            )}
            {profile?.role === 'operador-almoxarife' && (
              <p className="mt-1 text-xs text-gray-500">
                Como operador almoxarife, você gerencia apenas o estoque do seu CD
              </p>
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
              max={watchedMaxQuantity || undefined}
              step="1"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.quantity ? 'border-error-300' : ''
              }`}
              {...register('quantity', { 
                required: 'Quantidade é obrigatória',
                min: { value: 0, message: 'Quantidade deve ser maior ou igual a 0' },
                validate: (value) => {
                  if (watchedMaxQuantity && value > watchedMaxQuantity) {
                    return `Quantidade não pode exceder o limite máximo de ${watchedMaxQuantity}`;
                  }
                  return true;
                }
              })}
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-error-600">{errors.quantity.message}</p>
            )}
            {watchedQuantity === 0 && (
              <p className="mt-1 text-sm text-warning-600">⚠️ Item sem estoque no CD</p>
            )}
            {watchedMaxQuantity && watchedQuantity > watchedMaxQuantity && (
              <p className="mt-1 text-sm text-error-600">❌ Quantidade excede o limite máximo</p>
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
              step="1"
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
              step="1"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('max_quantity')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="unit_price" className="block text-sm font-medium text-gray-700">
            Preço Unitário (R$) *
          </label>
          <input
            id="unit_price"
            type="number"
            min="0"
            step="0.01"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.unit_price ? 'border-error-300' : ''
            }`}
            {...register('unit_price', { 
              required: 'Preço unitário é obrigatório',
              min: { value: 0, message: 'Preço deve ser maior ou igual a zero' }
            })}
          />
          {errors.unit_price && (
            <p className="mt-1 text-sm text-error-600">{errors.unit_price.message}</p>
          )}
          <p className="mt-1 text-xs text-gray-500">
            Este preço será usado para calcular o custo dos pedidos das unidades
          </p>
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Localização *
          </label>
          <input
            id="location"
            type="text"
            placeholder="Ex: Setor A, Prateleira 1, Almoxarifado Central"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.location ? 'border-error-300' : ''
            }`}
            {...register('location', { required: 'Localização é obrigatória' })}
          />
          {errors.location && (
            <p className="mt-1 text-sm text-error-600">{errors.location.message}</p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {stock ? 'Atualizar' : 'Ajustar'} Estoque CD
          </Button>
        </div>
      </form>
    </div>
  );
};

export default CDStockForm;