import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Inventory, Item, Unit } from '../../types/database';
import Button from '../../components/UI/Button';
import { createAuditLog, createMovementLog } from '../../utils/auditLogger';
import toast from 'react-hot-toast';

interface InventoryFormProps {
  inventory?: Inventory | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  item_id: string;
  unit_id: string;
  quantity: number;
  location: string;
  status: 'available' | 'reserved' | 'damaged' | 'expired';
  notes: string;
  description: string;
}

const InventoryForm: React.FC<InventoryFormProps> = ({ inventory, onSave, onCancel }) => {
  const [items, setItems] = useState<Item[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const [stockQuantity, setStockQuantity] = useState<number>(0);

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      item_id: inventory?.item_id || '',
      unit_id: inventory?.unit_id || '',
      quantity: inventory?.quantity || 1,
      location: inventory?.location || '',
      status: inventory?.status || 'available',
      notes: inventory?.notes || '',
      description: inventory?.description || '',
    }
  });

  const watchedItemId = watch('item_id');
  const watchedUnitId = watch('unit_id');
  const watchedQuantity = watch('quantity');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (watchedItemId) {
      const item = items.find(i => i.id === watchedItemId);
      setSelectedItem(item || null);
      
      // Se o item tem vida útil, forçar quantidade 1
      if (item?.has_lifecycle) {
        setValue('quantity', 1);
      }
    }
  }, [watchedItemId, items, setValue]);

  useEffect(() => {
    if (watchedItemId && watchedUnitId) {
      fetchStockQuantity();
    }
  }, [watchedItemId, watchedUnitId]);

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
        .eq('unit_id', watchedUnitId)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      setStockQuantity(data?.quantity || 0);
    } catch (error) {
      console.error('Error fetching stock quantity:', error);
      setStockQuantity(0);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Validar se item com vida útil tem quantidade 1
      if (selectedItem?.has_lifecycle && data.quantity !== 1) {
        toast.error('Itens com vida útil devem ter quantidade igual a 1');
        return;
      }

      // Validar se há estoque suficiente (apenas para novos registros)
      if (!inventory && data.quantity > stockQuantity) {
        toast.error(`Quantidade insuficiente no estoque. Disponível: ${stockQuantity}`);
        return;
      }

      const inventoryData = {
        item_id: data.item_id,
        unit_id: data.unit_id,
        quantity: Number(data.quantity),
        location: data.location,
        status: data.status,
        notes: data.notes || null,
        description: data.description || null,
      };

      let result;
      let movementQuantity = 0;

      if (inventory) {
        // Para edições, calcular diferença de quantidade
        const quantityDiff = Number(data.quantity) - inventory.quantity;
        movementQuantity = Math.abs(quantityDiff);
        
        if (quantityDiff > 0 && quantityDiff > stockQuantity) {
          toast.error(`Quantidade insuficiente no estoque para aumentar. Disponível: ${stockQuantity}`);
          return;
        }

        const oldValues = { ...inventory };

        result = await supabase
          .from('inventory')
          .update(inventoryData)
          .eq('id', inventory.id);

        if (result.error) throw result.error;

        // Atualizar estoque (subtrair diferença se positiva, somar se negativa)
        if (quantityDiff !== 0) {
          await supabase
            .from('stock')
            .update({ 
              quantity: stockQuantity - quantityDiff 
            })
            .eq('item_id', data.item_id)
            .eq('unit_id', data.unit_id);

          // Criar log de movimentação
          if (quantityDiff > 0) {
            // Moveu do estoque para inventário
            await createMovementLog(
              data.item_id,
              data.unit_id, // from stock
              data.unit_id, // to inventory (same unit)
              quantityDiff,
              'stock_to_inventory',
              `Inventory update - ID: ${inventory.id}`
            );
          } else {
            // Moveu do inventário para estoque
            await createMovementLog(
              data.item_id,
              data.unit_id, // from inventory
              data.unit_id, // to stock (same unit)
              Math.abs(quantityDiff),
              'inventory_to_stock',
              `Inventory update - ID: ${inventory.id}`
            );
          }
        }

        // Criar log de auditoria
        await createAuditLog({
          action: 'INVENTORY_UPDATED',
          tableName: 'inventory',
          recordId: inventory.id,
          oldValues,
          newValues: inventoryData
        });
      } else {
        // Para novos registros, inserir no inventário
        result = await supabase
          .from('inventory')
          .insert(inventoryData)
          .select()
          .single();

        if (result.error) throw result.error;

        movementQuantity = Number(data.quantity);

        // Subtrair do estoque
        await supabase
          .from('stock')
          .update({ 
            quantity: stockQuantity - Number(data.quantity) 
          })
          .eq('item_id', data.item_id)
          .eq('unit_id', data.unit_id);

        // Criar log de movimentação (estoque para inventário)
        await createMovementLog(
          data.item_id,
          data.unit_id, // from stock
          data.unit_id, // to inventory (same unit)
          Number(data.quantity),
          'stock_to_inventory',
          `New inventory record - ID: ${result.data.id}`
        );

        // Criar log de auditoria
        await createAuditLog({
          action: 'INVENTORY_CREATED',
          tableName: 'inventory',
          recordId: result.data.id,
          newValues: inventoryData
        });
      }

      onSave();
      toast.success(inventory ? 'Inventário atualizado com sucesso!' : 'Item adicionado ao inventário com sucesso!');
    } catch (error: any) {
      console.error('Error saving inventory:', error);
      toast.error(error.message || 'Erro ao salvar inventário');
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

  const maxQuantity = inventory ? stockQuantity + inventory.quantity : stockQuantity;

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Sobre o Inventário</h4>
        <p className="text-xs text-blue-700">
          Ao adicionar itens ao inventário, eles são automaticamente subtraídos do estoque.
          O inventário é usado para controle detalhado e rastreamento individual dos itens.
          Todas as movimentações são registradas automaticamente.
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
              disabled={!!inventory}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.item_id ? 'border-error-300' : ''
              } ${inventory ? 'bg-gray-100' : ''}`}
              {...register('item_id', { required: 'Item é obrigatório' })}
            >
              <option value="">Selecione um item</option>
              {items.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.code}) {item.has_lifecycle ? '- Vida Útil' : ''}
                </option>
              ))}
            </select>
            {errors.item_id && (
              <p className="mt-1 text-sm text-error-600">{errors.item_id.message}</p>
            )}
            {selectedItem?.has_lifecycle && (
              <p className="mt-1 text-xs text-info-600">
                ℹ️ Este item possui controle de vida útil e será individualizado
              </p>
            )}
          </div>

          <div>
            <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700">
              Unidade *
            </label>
            <select
              id="unit_id"
              disabled={!!inventory}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.unit_id ? 'border-error-300' : ''
              } ${inventory ? 'bg-gray-100' : ''}`}
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

        {watchedItemId && watchedUnitId && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
            <p className="text-sm text-gray-700">
              <strong>Estoque disponível:</strong> {stockQuantity} {selectedItem?.unit_measure}
            </p>
            {!inventory && stockQuantity === 0 && (
              <p className="text-sm text-error-600 mt-1">
                ⚠️ Não há estoque disponível para este item nesta unidade
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="quantity" className="block text-sm font-medium text-gray-700">
              Quantidade *
            </label>
            <input
              id="quantity"
              type="number"
              min="1"
              max={maxQuantity}
              step="0.01"
              disabled={selectedItem?.has_lifecycle}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.quantity ? 'border-error-300' : ''
              } ${selectedItem?.has_lifecycle ? 'bg-gray-100' : ''}`}
              {...register('quantity', { 
                required: 'Quantidade é obrigatória',
                min: { value: 1, message: 'Quantidade deve ser maior que 0' },
                max: { value: maxQuantity, message: `Quantidade máxima disponível: ${maxQuantity}` },
                validate: (value) => {
                  if (selectedItem?.has_lifecycle && value !== 1) {
                    return 'Itens com vida útil devem ter quantidade igual a 1';
                  }
                  return true;
                }
              })}
            />
            {errors.quantity && (
              <p className="mt-1 text-sm text-error-600">{errors.quantity.message}</p>
            )}
            {selectedItem?.has_lifecycle && (
              <p className="mt-1 text-xs text-gray-500">
                Quantidade fixa em 1 para itens com vida útil
              </p>
            )}
          </div>

          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700">
              Status *
            </label>
            <select
              id="status"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.status ? 'border-error-300' : ''
              }`}
              {...register('status', { required: 'Status é obrigatório' })}
            >
              <option value="available">Disponível</option>
              <option value="reserved">Reservado</option>
              <option value="damaged">Danificado</option>
              <option value="expired">Vencido</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-error-600">{errors.status.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="location" className="block text-sm font-medium text-gray-700">
            Localização *
          </label>
          <input
            id="location"
            type="text"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.location ? 'border-error-300' : ''
            }`}
            {...register('location', { required: 'Localização é obrigatória' })}
          />
          {errors.location && (
            <p className="mt-1 text-sm text-error-600">{errors.location.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Descrição específica deste item no inventário..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('description')}
          />
          <p className="mt-1 text-xs text-gray-500">
            Descrição específica para este registro de inventário
          </p>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Observações
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Observações gerais..."
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
            disabled={!inventory && stockQuantity === 0}
          >
            {inventory ? 'Atualizar' : 'Adicionar ao'} Inventário
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InventoryForm;