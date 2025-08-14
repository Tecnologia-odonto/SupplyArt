import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Stock, Item, Unit, Location } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
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
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      item_id: stock?.item_id || '',
      unit_id: stock?.unit_id || profile?.unit_id || '',
      quantity: stock?.quantity || 0,
      min_quantity: stock?.min_quantity || 0,
      max_quantity: stock?.max_quantity || 9999,
      location: stock?.location || '',
    }
  });

  const watchedUnitId = watch('unit_id');
  const watchedQuantity = watch('quantity');
  const watchedMaxQuantity = watch('max_quantity');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (watchedUnitId) {
      fetchLocations();
    }
  }, [watchedUnitId]);

  const fetchData = async () => {
    try {
      // Buscar apenas unidades que NÃO são CD
      let unitsQuery = supabase
        .from('units')
        .select('*')
        .eq('is_cd', false)
        .order('name');
      
      // Aplicar filtros baseados no role do usuário
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        // Operador administrativo: apenas sua unidade
        unitsQuery = unitsQuery.eq('id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: apenas sua unidade
        unitsQuery = unitsQuery.eq('id', profile.unit_id);
      }
      // Admin e operador-almoxarife: todas as unidades (não CDs)

      const [itemsResult, unitsResult] = await Promise.all([
        // Buscar itens baseado no role e unidade
        fetchItemsForUser(),
        unitsQuery
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

  const fetchItemsForUser = async () => {
    try {
      let itemsQuery = supabase.from('items').select('*').order('name');
      
      // Se for operador administrativo, mostrar apenas itens que existem no estoque da sua unidade
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        // Buscar itens que já existem no estoque da unidade do operador
        const { data: stockItems } = await supabase
          .from('stock')
          .select('item_id')
          .eq('unit_id', profile.unit_id);
        
        if (stockItems && stockItems.length > 0) {
          const itemIds = stockItems.map(stock => stock.item_id);
          itemsQuery = itemsQuery.in('id', itemIds);
        } else {
          // Se não há itens no estoque, retornar array vazio
          return { data: [], error: null };
        }
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: apenas itens que existem no estoque da sua unidade
        const { data: stockItems } = await supabase
          .from('stock')
          .select('item_id')
          .eq('unit_id', profile.unit_id);
        
        if (stockItems && stockItems.length > 0) {
          const itemIds = stockItems.map(stock => stock.item_id);
          itemsQuery = itemsQuery.in('id', itemIds);
        } else {
          return { data: [], error: null };
        }
      }
      // Admin e operador-almoxarife: todos os itens
      
      return await itemsQuery;
    } catch (error) {
      return { data: [], error };
    }
  };

  const fetchLocations = async () => {
    try {
      const { data, error } = await supabase
        .from('locations')
        .select('*')
        .eq('unit_id', watchedUnitId)
        .order('name');

      if (error) throw error;
      setLocations(data || []);
    } catch (error) {
      console.error('Error fetching locations:', error);
      setLocations([]);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Se uma nova localização foi digitada, criar na tabela de localizações
      if (data.location && locations.length === 0) {
        try {
          await supabase
            .from('locations')
            .insert({
              name: data.location,
              unit_id: data.unit_id,
              description: 'Criada automaticamente via estoque'
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
        unit_id: data.unit_id,
        quantity: Math.floor(Number(data.quantity)), // Garantir que seja inteiro
        min_quantity: data.min_quantity ? Number(data.min_quantity) : null,
        max_quantity: data.max_quantity ? Number(data.max_quantity) : null,
        location: data.location || null,
      };

      let result;
      if (stock) {
        // Atualizar estoque existente - substituir quantidade
        result = await supabase
          .from('stock')
          .update(stockData)
          .eq('id', stock.id);
      } else {
        // Verificar se já existe estoque para este item nesta unidade
        const { data: existingStock, error: checkError } = await supabase
          .from('stock')
          .select('*')
          .eq('item_id', data.item_id)
          .eq('unit_id', data.unit_id)
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
          };
          
          result = await supabase
            .from('stock')
            .update(updatedStockData)
            .eq('id', existingStock.id);
            
          toast.success(`Quantidade adicionada! Total agora: ${newQuantity}`);
        } else {
          // Criar novo registro de estoque
          result = await supabase
            .from('stock')
            .insert(stockData);
        }
      }

      if (result.error) throw result.error;

      onSave();
      toast.success(stock ? 'Estoque atualizado com sucesso!' : 'Estoque criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving stock:', error);
      
      // Mensagens de erro mais específicas
      if (error.code === '23505') {
        toast.error('Já existe um registro de estoque para este item nesta unidade');
      } else if (error.code === '42501') {
        toast.error('Você não tem permissão para realizar esta operação');
      } else {
        toast.error(error.message || 'Erro ao salvar estoque');
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
        <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Sobre o Inventário</h4>
        <p className="text-xs text-blue-700">
          <strong>Agrupamento Inteligente:</strong> Se o item já existe nesta unidade, a quantidade será somada ao total existente.
          Caso contrário, um novo registro será criado. Todas as movimentações são registradas automaticamente.
        </p>
      </div>

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
              disabled={profile?.role === 'operador-administrativo'}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.unit_id ? 'border-error-300' : ''
              } ${profile?.role === 'operador-administrativo' ? 'bg-gray-100' : ''}`}
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
            {profile?.role === 'operador-administrativo' && (
              <p className="mt-1 text-xs text-gray-500">
                Como operador administrativo, você só pode gerenciar estoque da sua unidade
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
              <p className="mt-1 text-sm text-warning-600">⚠️ Item sem estoque</p>
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
          {locations.length > 0 ? (
            <select
              id="location"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.location ? 'border-error-300' : ''
              }`}
              {...register('location', { required: 'Localização é obrigatória' })}
            >
              <option value="">Selecione uma localização</option>
              {locations.map((location) => (
                <option key={location.id} value={location.name}>
                  {location.name}
                  {location.description && ` - ${location.description}`}
                </option>
              ))}
            </select>
          ) : (
            <input
              id="location"
              type="text"
              placeholder="Ex: Estoque Geral, Recepção, Administração"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.location ? 'border-error-300' : ''
              }`}
              {...register('location', { required: 'Localização é obrigatória' })}
            />
          )}
          {errors.location && (
            <p className="mt-1 text-sm text-error-600">{errors.location.message}</p>
          )}
          {locations.length === 0 && watchedUnitId && (
            <p className="mt-1 text-xs text-blue-600">
              💡 Nenhuma localização cadastrada. Digite uma nova ou cadastre localizações no menu "Localizações".
            </p>
          )}
          {locations.length > 0 && (
            <p className="mt-1 text-xs text-gray-500">
              Localizações cadastradas para esta unidade. Para adicionar novas, acesse o menu "Localizações".
            </p>
          )}
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