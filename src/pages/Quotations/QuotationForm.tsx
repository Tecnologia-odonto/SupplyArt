import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface QuotationFormProps {
  quotation?: any;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  purchase_id: string;
  title: string;
  description: string;
  deadline: string;
  status: 'rascunho' | 'enviada' | 'em_analise' | 'finalizada' | 'cancelada';
}

interface PurchaseWithItems {
  id: string;
  unit: { name: string };
  purchase_items: Array<{
    id: string;
    item_id: string;
    quantity: number;
    item: {
      id: string;
      name: string;
      code: string;
      unit_measure: string;
    };
  }>;
}

const QuotationForm: React.FC<QuotationFormProps> = ({ quotation, onSave, onCancel }) => {
  const [purchases, setPurchases] = useState<PurchaseWithItems[]>([]);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseWithItems | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { profile } = useAuth();

  // Validar contexto necessário
  useEffect(() => {
    if (!profile) {
      setError('Dados insuficientes para nova cotação');
      setLoading(false);
    }
  }, [profile]);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      purchase_id: quotation?.purchase_id || '',
      title: quotation?.title || '',
      description: quotation?.description || '',
      deadline: quotation?.deadline || '',
      status: quotation?.status || 'rascunho',
    }
  });

  const watchedPurchaseId = watch('purchase_id');

  useEffect(() => {
    fetchPurchases();
  }, []);

  useEffect(() => {
    if (watchedPurchaseId) {
      const purchase = purchases.find(p => p.id === watchedPurchaseId);
      setSelectedPurchase(purchase || null);
    }
  }, [watchedPurchaseId, purchases]);

  const fetchPurchases = async () => {
    try {
      let query = supabase
        .from('purchases')
        .select(`
          id,
          unit:units(name),
          purchase_items:purchase_items(
            id,
            item_id,
            quantity,
            item:items(id, name, code, unit_measure)
          )
        `)
        .in('status', ['pedido-realizado', 'em-cotacao'])
        .order('created_at', { ascending: false });

      // Filtrar baseado no role
      if (profile?.role === 'operador-almoxarife' && profile.unit_id) {
        query = query.eq('unit_id', profile.unit_id);
      }

      const { data, error } = await query;
      if (error) throw error;
      setPurchases(data || []);
    } catch (error) {
      console.error('Error fetching purchases:', error);
      toast.error('Erro ao carregar pedidos de compra');
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
      const quotationData = {
        purchase_id: data.purchase_id,
        title: data.title,
        description: data.description || null,
        deadline: data.deadline || null,
        status: data.status,
        created_by: profile.id,
      };

      let quotationId: string;

      if (quotation) {
        // Atualizar cotação existente
        const { error } = await supabase
          .from('quotations')
          .update(quotationData)
          .eq('id', quotation.id);

        if (error) throw error;
        quotationId = quotation.id;
      } else {
        // Criar nova cotação
        const { data: newQuotation, error } = await supabase
          .from('quotations')
          .insert(quotationData)
          .select()
          .single();

        if (error) throw error;
        quotationId = newQuotation.id;

        // Criar itens da cotação baseados no pedido de compra
        if (selectedPurchase?.purchase_items) {
          const quotationItems = selectedPurchase.purchase_items.map(purchaseItem => ({
            quotation_id: quotationId,
            item_id: purchaseItem.item.id,
            item_code: purchaseItem.item.code,
            quantity: purchaseItem.quantity,
          }));

          const { error: itemsError } = await supabase
            .from('quotation_items')
            .insert(quotationItems);

          if (itemsError) throw itemsError;
        }

        // Atualizar status do pedido de compra para "em-cotacao"
        const { error: purchaseUpdateError } = await supabase
          .from('purchases')
          .update({ status: 'em-cotacao' })
          .eq('id', data.purchase_id);

        if (purchaseUpdateError) throw purchaseUpdateError;
      }

      toast.success(quotation ? 'Cotação atualizada com sucesso!' : 'Cotação criada com sucesso!');
      onSave();
    } catch (error: any) {
      console.error('Error saving quotation:', error);
      toast.error(error.message || 'Erro ao salvar cotação');
    }
  };

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center p-8 space-y-4">
        <div className="text-center">
          <span className="text-4xl">⚠️</span>
          <h3 className="mt-2 text-lg font-medium text-gray-900">Dados Insuficientes</h3>
          <p className="mt-1 text-sm text-gray-600">{error}</p>
        </div>
        <Button onClick={onCancel} variant="outline">
          Voltar
        </Button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-gray-600">Carregando...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Nova Cotação de Compras</h4>
        <p className="text-xs text-blue-700">
          Selecione um pedido de compra para criar uma cotação. Os itens do pedido serão automaticamente 
          incluídos na cotação para que você possa solicitar preços aos fornecedores.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="purchase_id" className="block text-sm font-medium text-gray-700">
              Pedido de Compra *
            </label>
            <select
              id="purchase_id"
              disabled={!!quotation}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.purchase_id ? 'border-error-300' : ''
              } ${quotation ? 'bg-gray-100' : ''}`}
              {...register('purchase_id', { required: 'Pedido de compra é obrigatório' })}
            >
              <option value="">Selecione um pedido de compra</option>
              {purchases.map((purchase) => (
                <option key={purchase.id} value={purchase.id}>
                  #{purchase.id.slice(0, 8)} - {purchase.unit?.name} ({purchase.purchase_items?.length || 0} itens)
                </option>
              ))}
            </select>
            {errors.purchase_id && (
              <p className="mt-1 text-sm text-error-600">{errors.purchase_id.message}</p>
            )}
            {!quotation && (
              <p className="mt-1 text-xs text-gray-500">
                Apenas pedidos com status "Pedido Realizado" ou "Em Cotação" aparecem aqui
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
              <option value="rascunho">Rascunho</option>
              <option value="enviada">Enviada</option>
              <option value="em_analise">Em Análise</option>
              <option value="finalizada">Finalizada</option>
              <option value="cancelada">Cancelada</option>
            </select>
            {errors.status && (
              <p className="mt-1 text-sm text-error-600">{errors.status.message}</p>
            )}
          </div>
        </div>

        <div>
          <label htmlFor="title" className="block text-sm font-medium text-gray-700">
            Título da Cotação *
          </label>
          <input
            id="title"
            type="text"
            placeholder="Ex: Cotação para materiais odontológicos - Janeiro 2024"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.title ? 'border-error-300' : ''
            }`}
            {...register('title', { required: 'Título é obrigatório' })}
          />
          {errors.title && (
            <p className="mt-1 text-sm text-error-600">{errors.title.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Descrição detalhada da cotação, condições especiais, etc."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('description')}
          />
        </div>

        <div>
          <label htmlFor="deadline" className="block text-sm font-medium text-gray-700">
            Prazo para Resposta
          </label>
          <input
            id="deadline"
            type="date"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('deadline')}
          />
          <p className="mt-1 text-xs text-gray-500">
            Data limite para os fornecedores enviarem suas propostas
          </p>
        </div>

        {/* Preview dos itens do pedido */}
        {selectedPurchase && (
          <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-gray-800 mb-3">
              📦 Itens do Pedido de Compra (serão incluídos na cotação)
            </h4>
            <div className="space-y-2">
              {selectedPurchase.purchase_items?.map((item) => (
                <div key={item.id} className="flex justify-between items-center text-sm">
                  <div>
                    <span className="font-medium">{item.item.name}</span>
                    <span className="text-gray-500 ml-2">({item.item.code})</span>
                  </div>
                  <span className="text-gray-600">
                    {item.quantity} {item.item.unit_measure}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {quotation ? 'Atualizar' : 'Criar'} Cotação
          </Button>
        </div>
      </form>
    </div>
  );
};

export default QuotationForm;