import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import Button from '../../components/UI/Button';
import Badge from '../../components/UI/Badge';
import toast from 'react-hot-toast';

interface QuotationResponseFormProps {
  quotationId: string;
  item: any;
  suppliers: any[];
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  supplier_id: string;
  unit_price: number;
  delivery_time: number;
  notes: string;
}

interface PriceHistoryItem {
  supplier_name: string;
  unit_price: number;
  purchase_date: string;
  quotation_title?: string;
}

const QuotationResponseForm: React.FC<QuotationResponseFormProps> = ({ 
  quotationId, 
  item, 
  suppliers, 
  onSave, 
  onCancel 
}) => {
  const [priceHistory, setPriceHistory] = useState<PriceHistoryItem[]>([]);
  const [loadingHistory, setLoadingHistory] = useState(true);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>();

  const watchedSupplierId = watch('supplier_id');
  const watchedUnitPrice = watch('unit_price');

  useEffect(() => {
    fetchPriceHistory();
  }, [item.item.id]);

  const fetchPriceHistory = async () => {
    try {
      const { data, error } = await supabase
        .from('price_history')
        .select(`
          *,
          suppliers!price_history_supplier_id_fkey(name),
          quotations!price_history_quotation_id_fkey(title)
        `)
        .eq('item_code', item.item.code)
        .order('purchase_date', { ascending: false })
        .limit(5);

      if (error) throw error;

      const formattedHistory = data?.map(record => ({
        supplier_name: record.suppliers?.name || 'Fornecedor não encontrado',
        unit_price: record.unit_price,
        purchase_date: record.purchase_date,
        quotation_title: record.quotations?.title
      })) || [];

      setPriceHistory(formattedHistory);
    } catch (error) {
      console.error('Error fetching price history:', error);
    } finally {
      setLoadingHistory(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Verificar se já existe resposta deste fornecedor para este item
      const { data: existingResponse, error: checkError } = await supabase
        .from('quotation_responses')
        .select('id')
        .eq('quotation_id', quotationId)
        .eq('supplier_id', data.supplier_id)
        .eq('item_code', item.item.code)
        .maybeSingle();

      if (checkError && checkError.code !== 'PGRST116') throw checkError;

      const responseData = {
        quotation_id: quotationId,
        supplier_id: data.supplier_id,
        item_id: item.item.id,
        item_code: item.item.code,
        unit_price: Number(data.unit_price),
        delivery_time: data.delivery_time ? Number(data.delivery_time) : null,
        notes: data.notes || null,
      };

      if (existingResponse) {
        // Atualizar resposta existente
        const { error } = await supabase
          .from('quotation_responses')
          .update(responseData)
          .eq('id', existingResponse.id);

        if (error) throw error;
        toast.success('Cotação atualizada com sucesso!');
      } else {
        // Criar nova resposta
        const { error } = await supabase
          .from('quotation_responses')
          .insert(responseData);

        if (error) throw error;
        toast.success('Cotação adicionada com sucesso!');
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving quotation response:', error);
      toast.error(error.message || 'Erro ao salvar cotação');
    }
  };

  const calculateTotal = () => {
    if (watchedUnitPrice && item.quantity) {
      return watchedUnitPrice * item.quantity;
    }
    return 0;
  };

  const getBestPriceForSupplier = (supplierId: string) => {
    return priceHistory.find(h => h.supplier_name === suppliers.find(s => s.id === supplierId)?.name);
  };

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">
          📋 Cotação para: {item.item.name} ({item.item.code})
        </h4>
        <p className="text-xs text-blue-700">
          Quantidade solicitada: <strong>{item.quantity} {item.item.unit_measure}</strong>
        </p>
      </div>

      {/* Histórico de Preços */}
      {priceHistory.length > 0 && (
        <Card>
          <h4 className="text-sm font-medium text-gray-800 mb-3">📈 Histórico de Preços (Últimas 5 compras)</h4>
          <div className="space-y-2">
            {priceHistory.map((history, index) => (
              <div key={index} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded">
                <div>
                  <span className="font-medium">{history.supplier_name}</span>
                  {history.quotation_title && (
                    <span className="text-gray-500 ml-2">({history.quotation_title})</span>
                  )}
                </div>
                <div className="text-right">
                  <div className="font-medium text-primary-600">
                    R$ {history.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                  </div>
                  <div className="text-xs text-gray-500">
                    {new Date(history.purchase_date).toLocaleDateString('pt-BR')}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700">
            Fornecedor *
          </label>
          <select
            id="supplier_id"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.supplier_id ? 'border-error-300' : ''
            }`}
            {...register('supplier_id', { required: 'Fornecedor é obrigatório' })}
          >
            <option value="">Selecione um fornecedor</option>
            {suppliers.map((supplier) => (
              <option key={supplier.id} value={supplier.id}>
                {supplier.name}
              </option>
            ))}
          </select>
          {errors.supplier_id && (
            <p className="mt-1 text-sm text-error-600">{errors.supplier_id.message}</p>
          )}
          
          {/* Mostrar histórico do fornecedor selecionado */}
          {watchedSupplierId && (() => {
            const supplierHistory = getBestPriceForSupplier(watchedSupplierId);
            return supplierHistory ? (
              <div className="mt-2 p-2 bg-green-50 border border-green-200 rounded">
                <p className="text-xs text-green-700">
                  💡 Último preço deste fornecedor: <strong>R$ {supplierHistory.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</strong> 
                  em {new Date(supplierHistory.purchase_date).toLocaleDateString('pt-BR')}
                </p>
              </div>
            ) : null;
          })()}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
          </div>

          <div>
            <label htmlFor="delivery_time" className="block text-sm font-medium text-gray-700">
              Prazo de Entrega (dias)
            </label>
            <input
              id="delivery_time"
              type="number"
              min="0"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('delivery_time')}
            />
          </div>
        </div>

        {/* Cálculo do total */}
        {watchedUnitPrice && (
          <div className="bg-primary-50 border border-primary-200 rounded-md p-4">
            <div className="flex justify-between items-center">
              <span className="text-sm font-medium text-gray-700">Total para este item:</span>
              <span className="text-lg font-bold text-primary-600">
                R$ {calculateTotal().toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
            <p className="text-xs text-gray-500 mt-1">
              {item.quantity} {item.item.unit_measure} × R$ {watchedUnitPrice}
            </p>
          </div>
        )}

        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-gray-700">
            Observações do Fornecedor
          </label>
          <textarea
            id="notes"
            rows={3}
            placeholder="Condições especiais, observações sobre entrega, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('notes')}
          />
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Salvar Cotação
          </Button>
        </div>
      </form>
    </div>
  );
};

export default QuotationResponseForm;