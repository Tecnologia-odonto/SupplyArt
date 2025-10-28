import React, { useEffect, useState } from 'react';
import { getTodayBrazilForInput } from '../../utils/dateHelper';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Supplier } from '../../types/database';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface InventoryItemFormProps {
  inventoryItem?: any;
  inventoryId: string;
  itemName: string;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  event_type: 'maintenance' | 'repair' | 'inspection' | 'relocation' | 'status_change' | 'other';
  description: string;
  performed_by: string;
  cost: number;
  notes: string;
  next_action_date: string;
  supplier_id: string;
}

const InventoryItemForm: React.FC<InventoryItemFormProps> = ({ 
  inventoryItem, 
  inventoryId,
  itemName,
  onSave, 
  onCancel 
}) => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      event_type: inventoryItem?.event_type || 'maintenance',
      description: inventoryItem?.description || '',
      performed_by: inventoryItem?.performed_by || '',
      cost: inventoryItem?.cost || 0,
      notes: inventoryItem?.notes || '',
      next_action_date: inventoryItem?.next_action_date || '',
      supplier_id: inventoryItem?.supplier_id || '',
    }
  });

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      const eventData = {
        inventory_id: inventoryId,
        event_type: data.event_type,
        description: data.description,
        performed_by: data.performed_by,
        cost: data.cost > 0 ? Number(data.cost) : null,
        notes: data.notes || null,
        next_action_date: data.next_action_date || null,
        supplier_id: data.supplier_id || null,
        event_date: getTodayBrazilForInput(),
      };

      let result;
      if (inventoryItem) {
        result = await supabase
          .from('inventory_events')
          .update(eventData)
          .eq('id', inventoryItem.id);
      } else {
        result = await supabase
          .from('inventory_events')
          .insert(eventData);
      }

      if (result.error) throw result.error;

      onSave();
      toast.success(inventoryItem ? 'Evento atualizado com sucesso!' : 'Evento registrado com sucesso!');
    } catch (error: any) {
      console.error('Error saving inventory event:', error);
      toast.error(error.message || 'Erro ao salvar evento');
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

  const eventTypes = [
    { value: 'maintenance', label: 'Manutenção' },
    { value: 'repair', label: 'Reparo' },
    { value: 'inspection', label: 'Inspeção' },
    { value: 'relocation', label: 'Relocação' },
    { value: 'status_change', label: 'Mudança de Status' },
    { value: 'other', label: 'Outro' },
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4 mb-4">
        <h4 className="text-sm font-medium text-blue-800 mb-1">📋 Registrar Evento - {itemName}</h4>
        <p className="text-xs text-blue-700">
          Use este formulário para registrar eventos, manutenções e alterações no histórico deste item.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="event_type" className="block text-sm font-medium text-gray-700">
              Tipo de Evento *
            </label>
            <select
              id="event_type"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.event_type ? 'border-error-300' : ''
              }`}
              {...register('event_type', { required: 'Tipo de evento é obrigatório' })}
            >
              {eventTypes.map((type) => (
                <option key={type.value} value={type.value}>
                  {type.label}
                </option>
              ))}
            </select>
            {errors.event_type && (
              <p className="mt-1 text-sm text-error-600">{errors.event_type.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="performed_by" className="block text-sm font-medium text-gray-700">
              Executado por
            </label>
            <input
              id="performed_by"
              type="text"
              placeholder="Nome da pessoa/empresa"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('performed_by')}
            />
          </div>

          <div>
            <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700">
              Fornecedor
            </label>
            <select
              id="supplier_id"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('supplier_id')}
            >
              <option value="">Selecione um fornecedor</option>
              {suppliers.map((supplier) => (
                <option key={supplier.id} value={supplier.id}>
                  {supplier.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição do Evento *
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Descreva o que foi feito, problema encontrado, etc."
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.description ? 'border-error-300' : ''
            }`}
            {...register('description', { required: 'Descrição é obrigatória' })}
          />
          {errors.description && (
            <p className="mt-1 text-sm text-error-600">{errors.description.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cost" className="block text-sm font-medium text-gray-700">
              Custo (R$)
            </label>
            <input
              id="cost"
              type="number"
              min="0"
              step="0.01"
              placeholder="0.00"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('cost')}
            />
          </div>

          <div>
            <label htmlFor="next_action_date" className="block text-sm font-medium text-gray-700">
              Próxima Ação Prevista
            </label>
            <input
              id="next_action_date"
              type="date"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('next_action_date')}
            />
          </div>
        </div>

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Observações Adicionais
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Observações, recomendações, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {inventoryItem ? 'Atualizar' : 'Registrar'} Evento
          </Button>
        </div>
      </form>
    </div>
  );
};

export default InventoryItemForm;