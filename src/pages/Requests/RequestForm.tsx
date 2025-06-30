import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Request, Unit, Item } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import { createAuditLog } from '../../utils/auditLogger';
import toast from 'react-hot-toast';

interface RequestFormProps {
  request?: Request | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  requesting_unit_id: string;
  cd_unit_id: string;
  priority: 'baixa' | 'normal' | 'alta' | 'urgente';
  notes: string;
  status: 'solicitado' | 'analisando' | 'aprovado' | 'rejeitado' | 'preparando' | 'enviado' | 'recebido' | 'aprovado-unidade' | 'erro-pedido' | 'cancelado';
}

interface RequestItemForm {
  item_id: string;
  quantity_requested: number;
  notes: string;
  unit_price?: number;
  has_error?: boolean;
  error_description?: string;
}

const RequestForm: React.FC<RequestFormProps> = ({ request, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [cdUnits, setCdUnits] = useState<Unit[]>([]);
  const [availableItems, setAvailableItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestItems, setRequestItems] = useState<RequestItemForm[]>([{ item_id: '', quantity_requested: 1, notes: '' }]);
  const { profile } = useAuth();

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      requesting_unit_id: request?.requesting_unit_id || profile?.unit_id || '',
      cd_unit_id: request?.cd_unit_id || '',
      priority: request?.priority || 'normal',
      notes: request?.notes || '',
      status: request?.status || 'solicitado',
    }
  });

  const watchedStatus = watch('status');
  const watchedCdUnitId = watch('cd_unit_id');
  const isNewRequest = !request;
  const canEditStatus = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);
  const canEditFinancial = watchedStatus === 'aprovado' && profile?.role && ['admin', 'gestor', 'operador-financeiro'].includes(profile.role);
  const isFinalized = ['aprovado-unidade', 'cancelado'].includes(watchedStatus);
  const canEditItems = !isFinalized && watchedStatus !== 'erro-pedido';

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (watchedCdUnitId) {
      fetchAvailableItems();
    }
  }, [watchedCdUnitId]);

  useEffect(() => {
    if (request) {
      fetchRequestItems();
    }
  }, [request]);

  const fetchData = async () => {
    try {
      const [unitsResult] = await Promise.all([
        supabase.from('units').select('*').order('name')
      ]);

      if (unitsResult.error) throw unitsResult.error;

      const allUnits = unitsResult.data || [];
      setUnits(allUnits);
      setCdUnits(allUnits.filter(unit => unit.is_cd));
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchAvailableItems = async () => {
    if (!watchedCdUnitId) return;

    try {
      // Buscar itens que:
      // 1. Estão marcados como "Exibir na empresa"
      // 2. Têm estoque disponível no CD selecionado
      const { data: stockItems, error } = await supabase
        .from('stock')
        .select(`
          quantity,
          item:items!inner(*)
        `)
        .eq('unit_id', watchedCdUnitId)
        .eq('item.show_in_company', true)
        .gt('quantity', 0);

      if (error) throw error;

      const items = stockItems?.map(stockItem => stockItem.item).filter(Boolean) || [];
      // Sort items by name on the client side instead of using order() with joined columns
      items.sort((a, b) => a.name.localeCompare(b.name));
      setAvailableItems(items);
    } catch (error) {
      console.error('Error fetching available items:', error);
      setAvailableItems([]);
    }
  };

  const fetchRequestItems = async () => {
    if (!request) return;

    try {
      const { data, error } = await supabase
        .from('request_items')
        .select('*')
        .eq('request_id', request.id);

      if (error) throw error;

      if (data && data.length > 0) {
        setRequestItems(data.map(item => ({
          item_id: item.item_id,
          quantity_requested: item.quantity_requested,
          notes: item.notes || '',
          unit_price: item.unit_price || undefined,
          has_error: item.has_error || false,
          error_description: item.error_description || ''
        })));
      }
    } catch (error) {
      console.error('Error fetching request items:', error);
    }
  };

  const addItem = () => {
    if (!canEditItems) return;
    setRequestItems([...requestItems, { item_id: '', quantity_requested: 1, notes: '' }]);
  };

  const removeItem = (index: number) => {
    if (!canEditItems || requestItems.length <= 1) return;
    setRequestItems(requestItems.filter((_, i) => i !== index));
  };

  const updateItem = (index: number, field: string, value: any) => {
    if (!canEditItems && !canEditFinancial) return;
    const updated = [...requestItems];
    updated[index] = { ...updated[index], [field]: value };
    setRequestItems(updated);
  };

  const calculateTotal = () => {
    return requestItems.reduce((sum, item) => {
      if (item.quantity_requested && item.unit_price) {
        return sum + (item.quantity_requested * item.unit_price);
      }
      return sum;
    }, 0);
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    // Validar se há pelo menos um item
    const validItems = requestItems.filter(item => item.item_id && item.quantity_requested > 0);
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }

    // Validações especiais para status aprovado
    if (data.status === 'aprovado' && canEditFinancial) {
      const hasInvalidPrices = validItems.some(item => !item.unit_price || item.unit_price <= 0);
      if (hasInvalidPrices) {
        toast.error('Todos os itens devem ter preço unitário definido para aprovar o pedido');
        return;
      }

      // Verificar orçamento da unidade
      const totalValue = calculateTotal();
      if (totalValue > 0) {
        const { data: budgetData } = await supabase
          .from('unit_budgets')
          .select('available_amount')
          .eq('unit_id', data.requesting_unit_id)
          .lte('period_start', new Date().toISOString().split('T')[0])
          .gte('period_end', new Date().toISOString().split('T')[0])
          .single();

        if (!budgetData || budgetData.available_amount < totalValue) {
          toast.error(`Orçamento insuficiente. Valor do pedido: R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`);
          return;
        }
      }
    }

    try {
      const oldValues = request ? { ...request } : null;
      
      const requestData = {
        requesting_unit_id: data.requesting_unit_id,
        cd_unit_id: data.cd_unit_id,
        requester_id: profile.id,
        priority: data.priority,
        notes: data.notes || null,
        status: canEditStatus ? data.status : (request?.status || 'solicitado'),
      };

      let requestId: string;

      if (request) {
        // Atualizar pedido existente
        const { error } = await supabase
          .from('requests')
          .update(requestData)
          .eq('id', request.id);

        if (error) throw error;
        requestId = request.id;

        // Remover itens existentes se puder editar
        if (canEditItems || canEditFinancial) {
          await supabase
            .from('request_items')
            .delete()
            .eq('request_id', request.id);
        }

        // Criar log de auditoria para atualização
        await createAuditLog({
          action: 'REQUEST_UPDATED',
          tableName: 'requests',
          recordId: request.id,
          oldValues,
          newValues: requestData
        });
      } else {
        // Criar novo pedido
        const { data: newRequest, error } = await supabase
          .from('requests')
          .insert(requestData)
          .select()
          .single();

        if (error) throw error;
        requestId = newRequest.id;

        // Criar log de auditoria para criação
        await createAuditLog({
          action: 'REQUEST_CREATED',
          tableName: 'requests',
          recordId: newRequest.id,
          newValues: requestData
        });
      }

      // Inserir/atualizar itens do pedido
      if (canEditItems || canEditFinancial) {
        const itemsToInsert = validItems.map(item => ({
          request_id: requestId,
          item_id: item.item_id,
          quantity_requested: Number(item.quantity_requested),
          notes: item.notes || null,
          unit_price: item.unit_price ? Number(item.unit_price) : null,
          has_error: item.has_error || false,
          error_description: item.error_description || null,
          needs_purchase: false, // Será atualizado pelo almoxarife
        }));

        const { error: itemsError } = await supabase
          .from('request_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Log dos itens
        await createAuditLog({
          action: 'REQUEST_ITEMS_UPDATED',
          tableName: 'request_items',
          recordId: requestId,
          newValues: { items: itemsToInsert }
        });
      }

      // Processar aprovação financeira
      if (data.status === 'aprovado' && canEditFinancial) {
        const totalValue = calculateTotal();
        
        if (totalValue > 0) {
          // Criar transação financeira
          await supabase
            .from('financial_transactions')
            .insert({
              type: 'expense',
              amount: totalValue,
              description: `Pedido interno aprovado #${requestId.slice(0, 8)}`,
              unit_id: data.requesting_unit_id,
              reference_type: 'request',
              reference_id: requestId,
              created_by: profile.id
            });

          // Atualizar orçamento da unidade
          await supabase
            .from('unit_budgets')
            .update({
              used_amount: supabase.raw(`used_amount + ${totalValue}`)
            })
            .eq('unit_id', data.requesting_unit_id)
            .lte('period_start', new Date().toISOString().split('T')[0])
            .gte('period_end', new Date().toISOString().split('T')[0]);
        }
      }

      onSave();
      toast.success(request ? 'Pedido atualizado com sucesso!' : 'Pedido criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving request:', error);
      toast.error(error.message || 'Erro ao salvar pedido');
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

  const statusOptions = [
    { value: 'solicitado', label: 'Solicitado', description: 'Pedido criado e aguardando análise' },
    { value: 'analisando', label: 'Analisando', description: 'Em análise pelo responsável do CD' },
    { value: 'aprovado', label: 'Aprovado', description: 'Pedido aprovado com valores definidos' },
    { value: 'rejeitado', label: 'Rejeitado', description: 'Pedido rejeitado pelo responsável' },
    { value: 'preparando', label: 'Preparando', description: 'Itens sendo preparados para envio' },
    { value: 'enviado', label: 'Enviado', description: 'Itens enviados para a unidade' },
    { value: 'recebido', label: 'Recebido', description: 'Itens recebidos pela unidade' },
    { value: 'aprovado-unidade', label: 'Aprovado pela Unidade', description: 'Unidade confirmou recebimento' },
    { value: 'erro-pedido', label: 'Erro no Pedido', description: 'Problema identificado no pedido' },
    { value: 'cancelado', label: 'Cancelado', description: 'Pedido cancelado' },
  ];

  const priorityOptions = [
    { value: 'baixa', label: 'Baixa', description: 'Sem urgência' },
    { value: 'normal', label: 'Normal', description: 'Prioridade padrão' },
    { value: 'alta', label: 'Alta', description: 'Necessário em breve' },
    { value: 'urgente', label: 'Urgente', description: 'Necessário imediatamente' },
  ];

  const totalValue = calculateTotal();

  return (
    <div className="max-w-4xl mx-auto">
      {/* Status de finalização */}
      {isFinalized && (
        <div className={`mb-6 ${watchedStatus === 'cancelado' ? 'bg-red-50 border-red-200' : 'bg-green-50 border-green-200'} border rounded-md p-4`}>
          <div className="flex items-center">
            <span className={`${watchedStatus === 'cancelado' ? 'text-red-600' : 'text-green-600'} text-xl mr-3`}>
              {watchedStatus === 'cancelado' ? '❌' : '✅'}
            </span>
            <div>
              <h4 className={`text-sm font-medium ${watchedStatus === 'cancelado' ? 'text-red-800' : 'text-green-800'}`}>
                Pedido {watchedStatus === 'cancelado' ? 'Cancelado' : 'Finalizado'}
              </h4>
              <p className={`text-sm ${watchedStatus === 'cancelado' ? 'text-red-700' : 'text-green-700'} mt-1`}>
                {watchedStatus === 'cancelado' 
                  ? 'Este pedido foi cancelado e não pode mais ser modificado.'
                  : 'Este pedido foi aprovado pela unidade e está finalizado.'
                }
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Informação sobre itens disponíveis */}
      <div className="mb-6 bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">📋 Itens Disponíveis para Pedido</h4>
        <p className="text-xs text-blue-700">
          Apenas itens com estoque disponível no CD selecionado e marcados como "Exibir na empresa" 
          estão disponíveis para pedidos internos.
        </p>
        {watchedCdUnitId && (
          <p className="text-xs text-blue-600 mt-1 font-medium">
            Itens disponíveis no CD selecionado: {availableItems.length}
          </p>
        )}
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informações Básicas */}
        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Informações do Pedido</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="requesting_unit_id" className="block text-sm font-medium text-gray-700 mb-1">
                Unidade Solicitante *
              </label>
              <select
                id="requesting_unit_id"
                disabled={!isNewRequest || isFinalized}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  errors.requesting_unit_id ? 'border-error-300' : ''
                } ${!isNewRequest || isFinalized ? 'bg-gray-100' : ''}`}
                {...register('requesting_unit_id', { required: 'Unidade solicitante é obrigatória' })}
              >
                <option value="">Selecione a unidade solicitante</option>
                {units.filter(unit => !unit.is_cd).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
              {errors.requesting_unit_id && (
                <p className="mt-1 text-sm text-error-600">{errors.requesting_unit_id.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="cd_unit_id" className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Distribuição *
              </label>
              <select
                id="cd_unit_id"
                disabled={!isNewRequest || isFinalized}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  errors.cd_unit_id ? 'border-error-300' : ''
                } ${!isNewRequest || isFinalized ? 'bg-gray-100' : ''}`}
                {...register('cd_unit_id', { required: 'Centro de distribuição é obrigatório' })}
              >
                <option value="">Selecione o CD responsável</option>
                {cdUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
              {errors.cd_unit_id && (
                <p className="mt-1 text-sm text-error-600">{errors.cd_unit_id.message}</p>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                Prioridade *
              </label>
              <select
                id="priority"
                disabled={isFinalized}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  isFinalized ? 'bg-gray-100' : ''
                }`}
                {...register('priority')}
              >
                {priorityOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              <p className="mt-1 text-xs text-gray-500">
                {priorityOptions.find(opt => opt.value === watch('priority'))?.description}
              </p>
            </div>

            {canEditStatus && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  id="status"
                  className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                  {...register('status')}
                >
                  {statusOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {statusOptions.find(opt => opt.value === watchedStatus)?.description}
                </p>
              </div>
            )}
          </div>

          <div className="mt-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              id="notes"
              rows={3}
              disabled={isFinalized}
              placeholder="Justificativa, urgência, observações especiais..."
              className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                isFinalized ? 'bg-gray-100' : ''
              }`}
              {...register('notes')}
            />
          </div>
        </div>

        {/* Itens do Pedido */}
        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
            <h3 className="text-lg font-medium text-gray-900">Itens Solicitados</h3>
            {canEditItems && (
              <Button 
                type="button" 
                variant="outline" 
                onClick={addItem} 
                size="sm"
                disabled={availableItems.length === 0}
              >
                + Adicionar Item
              </Button>
            )}
          </div>

          {!watchedCdUnitId && (
            <div className="mb-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-center">
                <span className="text-yellow-600 text-xl mr-3">⚠️</span>
                <div>
                  <h4 className="text-sm font-medium text-yellow-800">Selecione um CD</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Selecione um Centro de Distribuição para ver os itens disponíveis.
                  </p>
                </div>
              </div>
            </div>
          )}

          {watchedCdUnitId && availableItems.length === 0 && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-md p-4">
              <div className="flex items-center">
                <span className="text-red-600 text-xl mr-3">❌</span>
                <div>
                  <h4 className="text-sm font-medium text-red-800">Nenhum Item Disponível</h4>
                  <p className="text-sm text-red-700 mt-1">
                    Não há itens com estoque disponível no CD selecionado que estejam marcados como "Exibir na empresa".
                  </p>
                </div>
              </div>
            </div>
          )}

          <div className="space-y-4">
            {requestItems.map((requestItem, index) => (
              <div key={index} className={`p-4 border rounded-lg ${
                requestItem.has_error ? 'border-red-300 bg-red-50' : 'border-gray-200 bg-gray-50'
              }`}>
                {/* Mobile layout */}
                <div className="block sm:hidden space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item *
                    </label>
                    <select
                      value={requestItem.item_id}
                      onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                      disabled={!canEditItems}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        !canEditItems ? 'bg-gray-100' : ''
                      }`}
                    >
                      <option value="">Selecione um item</option>
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Quantidade *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={requestItem.quantity_requested}
                      onChange={(e) => updateItem(index, 'quantity_requested', Number(e.target.value))}
                      disabled={!canEditItems}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        !canEditItems ? 'bg-gray-100' : ''
                      }`}
                    />
                  </div>

                  {canEditFinancial && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preço Unitário (R$) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={requestItem.unit_price || ''}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value ? Number(e.target.value) : undefined)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      />
                    </div>
                  )}

                  {watchedStatus === 'erro-pedido' && canEditStatus && (
                    <div className="space-y-2">
                      <div className="flex items-center">
                        <input
                          type="checkbox"
                          checked={requestItem.has_error || false}
                          onChange={(e) => updateItem(index, 'has_error', e.target.checked)}
                          className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                        />
                        <label className="ml-2 block text-sm text-red-900">
                          Item com erro
                        </label>
                      </div>
                      {requestItem.has_error && (
                        <input
                          type="text"
                          value={requestItem.error_description || ''}
                          onChange={(e) => updateItem(index, 'error_description', e.target.value)}
                          placeholder="Descreva o erro (ex: item errado, quantidade incorreta, danificado)"
                          className="block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-sm"
                        />
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <input
                      type="text"
                      value={requestItem.notes}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      disabled={!canEditItems && !canEditFinancial}
                      placeholder="Especificações, observações..."
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        !canEditItems && !canEditFinancial ? 'bg-gray-100' : ''
                      }`}
                    />
                  </div>

                  {canEditItems && requestItems.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeItem(index)}
                      className="w-full"
                    >
                      Remover Item
                    </Button>
                  )}
                </div>

                {/* Desktop layout */}
                <div className="hidden sm:flex gap-4 items-end">
                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item *
                    </label>
                    <select
                      value={requestItem.item_id}
                      onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                      disabled={!canEditItems}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        !canEditItems ? 'bg-gray-100' : ''
                      }`}
                    >
                      <option value="">Selecione um item</option>
                      {availableItems.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="w-24">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Qtd *
                    </label>
                    <input
                      type="number"
                      min="1"
                      value={requestItem.quantity_requested}
                      onChange={(e) => updateItem(index, 'quantity_requested', Number(e.target.value))}
                      disabled={!canEditItems}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        !canEditItems ? 'bg-gray-100' : ''
                      }`}
                    />
                  </div>

                  {canEditFinancial && (
                    <div className="w-32">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Preço Unit. (R$) *
                      </label>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={requestItem.unit_price || ''}
                        onChange={(e) => updateItem(index, 'unit_price', e.target.value ? Number(e.target.value) : undefined)}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      />
                    </div>
                  )}

                  {watchedStatus === 'erro-pedido' && canEditStatus && (
                    <div className="w-40">
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Erro
                      </label>
                      <div className="space-y-1">
                        <div className="flex items-center">
                          <input
                            type="checkbox"
                            checked={requestItem.has_error || false}
                            onChange={(e) => updateItem(index, 'has_error', e.target.checked)}
                            className="h-4 w-4 text-red-600 focus:ring-red-500 border-gray-300 rounded"
                          />
                          <label className="ml-2 block text-xs text-red-900">
                            Com erro
                          </label>
                        </div>
                        {requestItem.has_error && (
                          <input
                            type="text"
                            value={requestItem.error_description || ''}
                            onChange={(e) => updateItem(index, 'error_description', e.target.value)}
                            placeholder="Descreva o erro"
                            className="block w-full rounded-md border-red-300 shadow-sm focus:border-red-500 focus:ring-red-500 text-xs"
                          />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="flex-1">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações
                    </label>
                    <input
                      type="text"
                      value={requestItem.notes}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      disabled={!canEditItems && !canEditFinancial}
                      placeholder="Especificações..."
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        !canEditItems && !canEditFinancial ? 'bg-gray-100' : ''
                      }`}
                    />
                  </div>

                  {canEditItems && requestItems.length > 1 && (
                    <Button
                      type="button"
                      variant="danger"
                      size="sm"
                      onClick={() => removeItem(index)}
                    >
                      Remover
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Total Financeiro */}
          {canEditFinancial && totalValue > 0 && (
            <div className="mt-4 p-4 rounded-lg bg-primary-50 border border-primary-200">
              <div className="flex justify-between items-center">
                <span className="text-lg font-medium text-gray-900">Total do Pedido:</span>
                <span className="text-xl font-bold text-primary-600">
                  R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              <p className="mt-2 text-sm text-primary-600">
                💰 Este valor será debitado do orçamento da unidade solicitante ao aprovar
              </p>
            </div>
          )}
        </div>

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
          {!isFinalized && (
            <Button 
              type="submit" 
              loading={isSubmitting} 
              className="w-full sm:w-auto"
              disabled={availableItems.length === 0 && canEditItems}
            >
              {request ? 'Atualizar' : 'Criar'} Pedido
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default RequestForm;