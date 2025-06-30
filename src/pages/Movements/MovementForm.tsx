import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Movement, Item, Unit } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import { createAuditLog, createMovementLog } from '../../utils/auditLogger';
import toast from 'react-hot-toast';

interface MovementFormProps {
  movement?: Movement | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  item_id: string;
  from_unit_id: string;
  to_unit_id: string;
  quantity: number;
  type: 'transfer' | 'adjustment';
  reference: string;
  notes: string;
}

const MovementForm: React.FC<MovementFormProps> = ({ movement, onSave, onCancel }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [stockQuantities, setStockQuantities] = useState<Record<string, number>>({});
  const { profile } = useAuth();

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      item_id: movement?.item_id || '',
      from_unit_id: movement?.from_unit_id || '',
      to_unit_id: movement?.to_unit_id || '',
      quantity: movement?.quantity || 0,
      type: movement?.type as 'transfer' | 'adjustment' || 'transfer',
      reference: movement?.reference || '',
      notes: movement?.notes || '',
    }
  });

  const watchedItemId = watch('item_id');
  const watchedFromUnitId = watch('from_unit_id');
  const watchedToUnitId = watch('to_unit_id');
  const watchedType = watch('type');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (watchedItemId && watchedFromUnitId) {
      fetchStockQuantity();
    }
  }, [watchedItemId, watchedFromUnitId]);

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

  const fetchStockQuantity = async () => {
    try {
      const { data, error } = await supabase
        .from('stock')
        .select('quantity')
        .eq('item_id', watchedItemId)
        .eq('unit_id', watchedFromUnitId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      
      const key = `${watchedItemId}-${watchedFromUnitId}`;
      setStockQuantities(prev => ({
        ...prev,
        [key]: data?.quantity || 0
      }));
    } catch (error) {
      console.error('Error fetching stock quantity:', error);
      const key = `${watchedItemId}-${watchedFromUnitId}`;
      setStockQuantities(prev => ({
        ...prev,
        [key]: 0
      }));
    }
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    try {
      // Validações específicas por tipo
      if (data.type === 'transfer') {
        if (data.from_unit_id === data.to_unit_id) {
          toast.error('Unidade de origem deve ser diferente da unidade de destino para transferências');
          return;
        }

        // Verificar estoque disponível na unidade de origem
        const stockKey = `${data.item_id}-${data.from_unit_id}`;
        const availableStock = stockQuantities[stockKey] || 0;
        
        if (data.quantity > availableStock) {
          toast.error(`Quantidade insuficiente no estoque da unidade de origem. Disponível: ${availableStock}`);
          return;
        }
      }

      if (data.type === 'adjustment') {
        // Para ajustes, origem e destino devem ser a mesma unidade
        data.to_unit_id = data.from_unit_id;
      }

      const movementData = {
        item_id: data.item_id,
        from_unit_id: data.from_unit_id,
        to_unit_id: data.to_unit_id,
        quantity: Number(data.quantity),
        type: data.type,
        reference: data.reference || null,
        notes: data.notes || null,
        created_by: profile.id,
      };

      let result;
      if (movement) {
        const oldValues = { ...movement };
        
        result = await supabase
          .from('movements')
          .update(movementData)
          .eq('id', movement.id);

        if (result.error) throw result.error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'MOVEMENT_UPDATED',
          tableName: 'movements',
          recordId: movement.id,
          oldValues,
          newValues: movementData
        });
      } else {
        result = await supabase
          .from('movements')
          .insert(movementData)
          .select()
          .single();

        if (result.error) throw result.error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'MOVEMENT_CREATED',
          tableName: 'movements',
          recordId: result.data.id,
          newValues: movementData
        });
      }

      // Atualizar estoques baseado no tipo de movimento
      if (data.type === 'transfer') {
        // Transferência: subtrair da origem e somar no destino
        
        // Subtrair da unidade de origem
        await supabase
          .from('stock')
          .update({ 
            quantity: supabase.raw(`quantity - ${data.quantity}`)
          })
          .eq('item_id', data.item_id)
          .eq('unit_id', data.from_unit_id);

        // Verificar se existe estoque na unidade de destino
        const { data: destStock } = await supabase
          .from('stock')
          .select('*')
          .eq('item_id', data.item_id)
          .eq('unit_id', data.to_unit_id)
          .single();

        if (destStock) {
          // Somar na unidade de destino
          await supabase
            .from('stock')
            .update({ 
              quantity: supabase.raw(`quantity + ${data.quantity}`)
            })
            .eq('item_id', data.item_id)
            .eq('unit_id', data.to_unit_id);
        } else {
          // Criar novo registro de estoque na unidade de destino
          await supabase
            .from('stock')
            .insert({
              item_id: data.item_id,
              unit_id: data.to_unit_id,
              quantity: data.quantity,
              location: 'Estoque Geral'
            });
        }

      } else if (data.type === 'adjustment') {
        // Ajuste: definir quantidade absoluta no estoque
        const { data: currentStock } = await supabase
          .from('stock')
          .select('*')
          .eq('item_id', data.item_id)
          .eq('unit_id', data.from_unit_id)
          .single();

        if (currentStock) {
          await supabase
            .from('stock')
            .update({ quantity: data.quantity })
            .eq('item_id', data.item_id)
            .eq('unit_id', data.from_unit_id);
        } else {
          // Criar novo registro se não existir
          await supabase
            .from('stock')
            .insert({
              item_id: data.item_id,
              unit_id: data.from_unit_id,
              quantity: data.quantity,
              location: 'Estoque Geral'
            });
        }
      }

      onSave();
      toast.success(movement ? 'Movimentação atualizada com sucesso!' : 'Movimentação criada com sucesso!');
    } catch (error: any) {
      console.error('Error saving movement:', error);
      toast.error(error.message || 'Erro ao salvar movimentação');
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

  const stockKey = `${watchedItemId}-${watchedFromUnitId}`;
  const availableStock = stockQuantities[stockKey] || 0;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Tipos de Movimentação</h4>
        <div className="text-xs text-blue-700 space-y-1">
          <p><strong>Transferência:</strong> Move itens entre unidades diferentes</p>
          <p><strong>Ajuste:</strong> Corrige quantidade no estoque da unidade</p>
          <p><strong>Nota:</strong> Movimentações de "Compra" são criadas automaticamente quando pedidos são finalizados</p>
        </div>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
          <label htmlFor="type" className="block text-sm font-medium text-gray-700">
            Tipo de Movimentação *
          </label>
          <select
            id="type"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.type ? 'border-error-300' : ''
            }`}
            {...register('type', { required: 'Tipo é obrigatório' })}
          >
            <option value="transfer">Transferência</option>
            <option value="adjustment">Ajuste</option>
          </select>
          {errors.type && (
            <p className="mt-1 text-sm text-error-600">{errors.type.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="from_unit_id" className="block text-sm font-medium text-gray-700">
              {watchedType === 'adjustment' ? 'Unidade *' : 'Unidade de Origem *'}
            </label>
            <select
              id="from_unit_id"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.from_unit_id ? 'border-error-300' : ''
              }`}
              {...register('from_unit_id', { required: 'Unidade de origem é obrigatória' })}
            >
              <option value="">Selecione a unidade</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
            {errors.from_unit_id && (
              <p className="mt-1 text-sm text-error-600">{errors.from_unit_id.message}</p>
            )}
          </div>

          {watchedType === 'transfer' && (
            <div>
              <label htmlFor="to_unit_id" className="block text-sm font-medium text-gray-700">
                Unidade de Destino *
              </label>
              <select
                id="to_unit_id"
                className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                  errors.to_unit_id ? 'border-error-300' : ''
                }`}
                {...register('to_unit_id', { 
                  required: watchedType === 'transfer' ? 'Unidade de destino é obrigatória' : false 
                })}
              >
                <option value="">Selecione a unidade de destino</option>
                {units.filter(unit => unit.id !== watchedFromUnitId).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
              {errors.to_unit_id && (
                <p className="mt-1 text-sm text-error-600">{errors.to_unit_id.message}</p>
              )}
            </div>
          )}
        </div>

        {watchedItemId && watchedFromUnitId && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-700">
              <strong>Estoque atual na unidade:</strong> {availableStock}
            </p>
            {watchedType === 'transfer' && availableStock === 0 && (
              <p className="text-sm text-error-600 mt-1">
                ⚠️ Não há estoque disponível para transferência
              </p>
            )}
          </div>
        )}

        <div>
          <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
            {watchedType === 'adjustment' ? 'Nova Quantidade *' : 'Quantidade a Transferir *'}
          </label>
          <input
            id="quantity"
            type="number"
            min="0"
            step="0.01"
            max={watchedType === 'transfer' ? availableStock : undefined}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.quantity ? 'border-error-300' : ''
            }`}
            {...register('quantity', { 
              required: 'Quantidade é obrigatória',
              min: { value: 0, message: 'Quantidade deve ser maior ou igual a 0' },
              max: watchedType === 'transfer' ? { 
                value: availableStock, 
                message: `Quantidade máxima disponível: ${availableStock}` 
              } : undefined
            })}
          />
          {errors.quantity && (
            <p className="mt-1 text-sm text-error-600">{errors.quantity.message}</p>
          )}
          {watchedType === 'adjustment' && (
            <p className="mt-1 text-xs text-gray-500">
              Para ajustes, informe a quantidade final que deve ficar no estoque
            </p>
          )}
        </div>

        <div>
          <label htmlFor="reference" className="block text-sm font-medium text-gray-700">
            Referência
          </label>
          <input
            id="reference"
            type="text"
            placeholder="Ex: Solicitação #123, Ordem de serviço #456"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('reference')}
          />
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Observações
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Motivo da movimentação, observações adicionais..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button 
            type="submit" 
            loading={isSubmitting}
            disabled={watchedType === 'transfer' && availableStock === 0}
          >
            {movement ? 'Atualizar' : 'Criar'} Movimentação
          </Button>
        </div>
      </form>
    </div>
  );
};

export default MovementForm;