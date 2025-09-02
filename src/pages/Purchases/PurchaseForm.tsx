import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Purchase, Unit, Supplier, Item } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import { createAuditLog } from '../../utils/auditLogger';
import toast from 'react-hot-toast';

interface PurchaseFormProps {
  purchase?: Purchase | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  unit_id: string;
  supplier_id: string;
  total_value: number;
  notes: string;
  status: 'pedido-realizado' | 'em-cotacao' | 'comprado-aguardando' | 'chegou-cd' | 'enviado' | 'erro-pedido' | 'finalizado';
}

interface PurchaseItemForm {
  item_id: string;
  quantity: number;
  unit_price?: number;
  supplier_id?: string;
}

interface UnitBudgetInfo {
  available_amount: number;
  period_start: string;
  period_end: string;
  budget_amount: number;
  used_amount: number;
}

const PurchaseForm: React.FC<PurchaseFormProps> = ({ purchase, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [unitBudgets, setUnitBudgets] = useState<Record<string, UnitBudgetInfo>>({});
  const [loading, setLoading] = useState(true);
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemForm[]>([{ item_id: '', quantity: 1 }]);
  const [isFinalizingPurchase, setIsFinalizingPurchase] = useState(false);
  const [quotationStatus, setQuotationStatus] = useState<{
    hasQuotations: boolean;
    allItemsQuoted: boolean;
    quotationDetails: any[];
  }>({ hasQuotations: false, allItemsQuoted: false, quotationDetails: [] });
  const { profile } = useAuth();

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      unit_id: purchase?.unit_id || profile?.unit_id || '',
      supplier_id: purchase?.supplier_id || '',
      total_value: purchase?.total_value || 0,
      notes: purchase?.notes || '',
      status: purchase?.status || 'pedido-realizado',
    }
  });

  const watchedStatus = watch('status');
  const watchedUnitId = watch('unit_id');
  const isNewPurchase = !purchase;
  const canEditFinancialInfo = profile?.role && ['admin', 'gestor', 'operador-financeiro'].includes(profile.role);
  const canEditStatus = profile?.role && ['admin', 'gestor', 'operador-financeiro', 'operador-almoxarife'].includes(profile.role);
  const isFinalized = purchase?.status === 'finalizado';
  const isBeingFinalized = watchedStatus === 'finalizado' && purchase?.status !== 'finalizado';

  // Calcular valor total automaticamente
  const calculateTotal = () => {
    const total = purchaseItems.reduce((sum, item) => {
      if (item.quantity && item.unit_price) {
        return sum + (item.quantity * item.unit_price);
      }
      return sum;
    }, 0);
    
    setValue('total_value', total);
    return total;
  };

  // Recalcular sempre que os itens mudarem
  useEffect(() => {
    if (canEditFinancialInfo) {
      calculateTotal();
    }
  }, [purchaseItems, canEditFinancialInfo]);

  // Buscar dados atualizados quando o formulário abrir
  useEffect(() => {
    if (purchase) {
      // Recarregar dados da compra para pegar preços atualizados das cotações
      const reloadPurchaseData = async () => {
        try {
          const { data: updatedPurchase, error: purchaseError } = await supabase
            .from('purchases')
            .select('total_value')
            .eq('id', purchase.id)
            .single();

          if (purchaseError) throw purchaseError;
          
          if (updatedPurchase?.total_value !== purchase.total_value) {
            setValue('total_value', updatedPurchase.total_value || 0);
          }

          // Recarregar itens da compra para pegar preços atualizados
          const { data: updatedItems, error: itemsError } = await supabase
            .from('purchase_items')
            .select('*')
            .eq('purchase_id', purchase.id);

          if (itemsError) throw itemsError;

          if (updatedItems && updatedItems.length > 0) {
            const updatedPurchaseItems = updatedItems.map(item => ({
              item_id: item.item_id,
              quantity: item.quantity,
              unit_price: item.unit_price || undefined,
              supplier_id: item.supplier_id || undefined
            }));
            
            setPurchaseItems(updatedPurchaseItems);
            console.log('🔄 Reloaded purchase items with updated prices:', updatedPurchaseItems);
          }
        } catch (error) {
          console.error('Error reloading purchase data:', error);
        }
      };

      reloadPurchaseData();
    }
  }, [purchase, setValue]);

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    if (purchase) {
      fetchPurchaseItems();
    }
  }, [purchase]);

  const fetchData = async () => {
    try {
      const currentDate = new Date().toISOString().split('T')[0];
      
      const [unitsResult, suppliersResult, itemsResult, budgetsResult] = await Promise.all([
        // Buscar apenas Centros de Distribuição
        supabase.from('units').select('*').eq('is_cd', true).order('name'),
        supabase.from('suppliers').select('*').order('name'),
        // Filtrar apenas itens que devem ser exibidos na empresa
        supabase.from('items').select('*').eq('show_in_company', true).order('name'),
        // Buscar orçamentos válidos para a data atual
        supabase
          .from('unit_budgets')
          .select('unit_id, available_amount, period_start, period_end, budget_amount, used_amount')
          .lte('period_start', currentDate)
          .gte('period_end', currentDate)
      ]);

      if (unitsResult.error) throw unitsResult.error;
      if (suppliersResult.error) throw suppliersResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setUnits(unitsResult.data || []);
      setSuppliers(suppliersResult.data || []);
      setItems(itemsResult.data || []);

      // Criar mapa de orçamentos disponíveis por unidade para o período atual
      const budgetMap: Record<string, UnitBudgetInfo> = {};
      if (budgetsResult.data) {
        budgetsResult.data.forEach(budget => {
          budgetMap[budget.unit_id] = {
            available_amount: budget.available_amount,
            period_start: budget.period_start,
            period_end: budget.period_end,
            budget_amount: budget.budget_amount,
            used_amount: budget.used_amount
          };
        });
      }
      setUnitBudgets(budgetMap);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchPurchaseItems = async () => {
    if (!purchase) return;

    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select('*, supplier:suppliers(name)')
        .eq('purchase_id', purchase.id);

      if (error) throw error;

      if (data && data.length > 0) {
        setPurchaseItems(data.map(item => ({
          item_id: item.item_id,
          quantity: item.quantity,
          unit_price: item.unit_price || undefined,
          supplier_id: item.supplier_id || undefined
        })));
      }
    } catch (error) {
      console.error('Error fetching purchase items:', error);
    }
  };

  const addItem = () => {
    setPurchaseItems([...purchaseItems, { item_id: '', quantity: 1 }]);
  };

  const removeItem = (index: number) => {
    if (purchaseItems.length > 1) {
      setPurchaseItems(purchaseItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...purchaseItems];
    updated[index] = { ...updated[index], [field]: value };
    setPurchaseItems(updated);
  };

  const getItemTotal = (item: PurchaseItemForm) => {
    if (item.quantity && item.unit_price) {
      return item.quantity * item.unit_price;
    }
    return 0;
  };

  const checkBudgetLimit = (unitId: string, amount: number) => {
    const budgetInfo = unitBudgets[unitId];
    if (!budgetInfo) {
      return { 
        hasValidBudget: false, 
        canPurchase: false, 
        message: 'Unidade não possui orçamento definido para o período atual' 
      };
    }
    
    const canPurchase = budgetInfo.available_amount >= amount;
    return { 
      hasValidBudget: true, 
      canPurchase, 
      availableAmount: budgetInfo.available_amount,
      budgetInfo,
      message: canPurchase ? 'Orçamento suficiente' : 'Valor excede orçamento disponível'
    };
  };

  const validatePurchaseForFinalization = () => {
    const validItems = purchaseItems.filter(item => item.item_id && item.quantity > 0);
    
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido antes de finalizar');
      return false;
    }

    const hasInvalidItems = validItems.some(item => !item.unit_price || item.unit_price <= 0);
    if (hasInvalidItems) {
      toast.error('Todos os itens devem ter preço unitário definido para finalizar a compra');
      return false;
    }

    return true;
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    // Validar se há pelo menos um item
    const validItems = purchaseItems.filter(item => item.item_id && item.quantity > 0);
    if (validItems.length === 0) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }

    // Validações especiais para finalização
    if (isBeingFinalized) {
      if (!validatePurchaseForFinalization()) {
        return;
      }
      
      setIsFinalizingPurchase(true);
      
      // Confirmar finalização
      const confirmMessage = `
        ⚠️ ATENÇÃO: Finalizar Compra
        
        Ao finalizar esta compra:
        • Os itens serão automaticamente adicionados ao estoque da unidade
        • A compra não poderá mais ser editada
        • O valor será debitado do orçamento da unidade
        
        Deseja continuar?
      `;
      
      if (!window.confirm(confirmMessage)) {
        setIsFinalizingPurchase(false);
        return;
      }
    }

    // Calcular o valor total final
    const calculatedTotal = calculateTotal();

    // Verificar limite de orçamento para qualquer valor > 0
    if (calculatedTotal > 0) {
      const budgetCheck = checkBudgetLimit(data.unit_id, calculatedTotal);
      
      if (!budgetCheck.hasValidBudget) {
        toast.error(`❌ ${budgetCheck.message}`);
        setIsFinalizingPurchase(false);
        return;
      }
      
      if (!budgetCheck.canPurchase) {
        const availableBudget = budgetCheck.availableAmount || 0;
        toast.error(`❌ Valor da compra (R$ ${calculatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) excede o orçamento disponível da unidade (R$ ${availableBudget.toLocaleString('pt-BR', { minimumFractionDigits: 2 })})`);
        setIsFinalizingPurchase(false);
        return;
      }
    }

    try {
      const oldValues = purchase ? { ...purchase } : null;
      
      const purchaseData = {
        unit_id: data.unit_id,
        requester_id: profile.id,
        supplier_id: canEditFinancialInfo ? (data.supplier_id || null) : purchase?.supplier_id || null,
        total_value: canEditFinancialInfo ? calculatedTotal : purchase?.total_value || null,
        notes: data.notes || null,
        status: canEditStatus ? data.status : (purchase?.status || 'pedido-realizado'),
      };

      let purchaseId: string;

      if (purchase) {
        // Atualizar compra existente
        const { error } = await supabase
          .from('purchases')
          .update(purchaseData)
          .eq('id', purchase.id);

        if (error) throw error;
        purchaseId = purchase.id;

        // Remover itens existentes se for uma edição completa
        if (canEditFinancialInfo || isNewPurchase) {
          await supabase
            .from('purchase_items')
            .delete()
            .eq('purchase_id', purchase.id);
        }

        // Criar log de auditoria para atualização
        await createAuditLog({
          action: isBeingFinalized ? 'PURCHASE_FINALIZED' : 'PURCHASE_UPDATED',
          tableName: 'purchases',
          recordId: purchase.id,
          oldValues,
          newValues: purchaseData
        });
      } else {
        // Criar nova compra
        const { data: newPurchase, error } = await supabase
          .from('purchases')
          .insert(purchaseData)
          .select()
          .single();

        if (error) throw error;
        purchaseId = newPurchase.id;

        // Criar log de auditoria para criação
        await createAuditLog({
          action: 'PURCHASE_CREATED',
          tableName: 'purchases',
          recordId: newPurchase.id,
          newValues: purchaseData
        });
      }

      // Inserir/atualizar itens da compra
      if (canEditFinancialInfo || isNewPurchase) {
        const itemsToInsert = validItems.map(item => ({
          purchase_id: purchaseId,
          item_id: item.item_id,
          quantity: Number(item.quantity),
          unit_price: item.unit_price ? Number(item.unit_price) : null,
          total_price: item.unit_price && item.quantity ? Number(item.unit_price) * Number(item.quantity) : null,
          supplier_id: item.supplier_id || null,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Log dos itens
        await createAuditLog({
          action: 'PURCHASE_ITEMS_UPDATED',
          tableName: 'purchase_items',
          recordId: purchaseId,
          newValues: { items: itemsToInsert }
        });
      }

      if (isBeingFinalized) {
        toast.success('🎉 Compra finalizada com sucesso! Os itens foram adicionados ao estoque automaticamente.');
      } else {
        toast.success(purchase ? 'Compra atualizada com sucesso!' : 'Pedido de compra criado com sucesso!');
      }

      onSave();
    } catch (error: any) {
      console.error('Error saving purchase:', error);
      toast.error(error.message || 'Erro ao salvar compra');
    } finally {
      setIsFinalizingPurchase(false);
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
    { value: 'pedido-realizado', label: 'Pedido Realizado', description: 'Pedido criado e aguardando processamento' },
    { value: 'em-cotacao', label: 'Em Cotação', description: 'Cotando preços com fornecedores' },
    { value: 'comprado-aguardando', label: 'Comprado - Aguardando Recebimento', description: 'Compra realizada, aguardando entrega' },
    { value: 'chegou-cd', label: 'Chegou ao CD', description: 'Mercadoria chegou ao Centro de Distribuição' },
    { value: 'enviado', label: 'Enviado', description: 'Enviado para as unidades' },
    { value: 'erro-pedido', label: 'Erro no Pedido', description: 'Problema identificado no pedido' },
    { value: 'finalizado', label: 'Finalizado', description: 'Pedido concluído - itens adicionados ao estoque' },
  ];

  const totalValue = calculateTotal();
  const budgetCheck = watchedUnitId ? checkBudgetLimit(watchedUnitId, totalValue) : null;
  const budgetExceeded = totalValue > 0 && budgetCheck && !budgetCheck.canPurchase;
  const noBudget = budgetCheck && !budgetCheck.hasValidBudget;

  return (
    <div className="max-w-4xl mx-auto">
      {/* Alerta de compra finalizada */}
      {isFinalized && (
        <div className="mb-6 bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-green-600 text-xl">✅</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-green-800">Compra Finalizada</h3>
              <p className="text-sm text-green-700 mt-1">
                Esta compra foi finalizada e os itens foram automaticamente adicionados ao estoque. 
                Não é possível editar compras finalizadas.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de finalização */}
      {isBeingFinalized && (
        <div className="mb-6 bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-yellow-600 text-xl">⚠️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-yellow-800">Finalizando Compra</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Ao finalizar, os itens serão automaticamente adicionados ao estoque da unidade e a compra não poderá mais ser editada.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Alerta de orçamento */}
      {noBudget && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-red-600 text-xl">❌</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-red-800">Sem Orçamento Válido</h3>
              <p className="text-sm text-red-700 mt-1">
                A unidade selecionada não possui orçamento definido para o período atual. 
                Configure um orçamento no módulo financeiro antes de criar pedidos de compra.
              </p>
            </div>
          </div>
        </div>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Informações Básicas */}
        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700 mb-1">
                Centro de Distribuição
              </label>
              <select
                id="unit_id"
                disabled={!isNewPurchase || isFinalized}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  errors.unit_id ? 'border-error-300' : ''
                } ${!isNewPurchase || isFinalized ? 'bg-gray-100' : ''}`}
                {...register('unit_id', { required: 'Unidade é obrigatória' })}
              >
                <option value="">Selecione um Centro de Distribuição</option>
                {units.filter(unit => unit.is_cd).map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name} {unit.is_cd ? '(CD)' : ''}
                  </option>
                ))}
              </select>
              {errors.unit_id && (
                <p className="mt-1 text-sm text-error-600">{errors.unit_id.message}</p>
              )}
              {watchedUnitId && budgetCheck && (
                <div className="mt-1 text-xs">
                  {budgetCheck.hasValidBudget ? (
                    <div>
                      <p className="text-green-600">
                        ✅ Orçamento disponível: R$ {budgetCheck.availableAmount?.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </p>
                      <p className="text-gray-500">
                        Período: {new Date(budgetCheck.budgetInfo.period_start).toLocaleDateString('pt-BR')} até {new Date(budgetCheck.budgetInfo.period_end).toLocaleDateString('pt-BR')}
                      </p>
                    </div>
                  ) : (
                    <p className="text-red-600">❌ {budgetCheck.message}</p>
                  )}
                </div>
              )}
            </div>

            {canEditStatus && (
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  id="status"
                  disabled={isFinalized}
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                    isFinalized ? 'bg-gray-100' : ''
                  } ${isBeingFinalized ? 'border-yellow-300 bg-yellow-50' : ''}`}
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
                {isBeingFinalized && (
                  <p className="mt-1 text-xs text-yellow-600">
                    ⚠️ Finalizar irá adicionar os itens ao estoque automaticamente
                  </p>
                )}
              </div>
            )}
          </div>

          {canEditFinancialInfo && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="supplier_id" className="block text-sm font-medium text-gray-700 mb-1">
                  Fornecedor
                </label>
                <select
                  id="supplier_id"
                  disabled={isFinalized}
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                    isFinalized ? 'bg-gray-100' : ''
                  }`}
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

              <div>
                <label htmlFor="total_value" className="block text-sm font-medium text-gray-700 mb-1">
                  Valor Total (R$) - Calculado Automaticamente
                </label>
                <input
                  id="total_value"
                  type="text"
                  readOnly
                  className={`block w-full rounded-md border-gray-300 bg-gray-50 shadow-sm text-sm ${
                    budgetExceeded ? 'border-error-300 bg-error-50' : 
                    noBudget ? 'border-error-300 bg-error-50' : ''
                  }`}
                  value={`R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Este valor é calculado automaticamente com base nos itens
                </p>
                {budgetExceeded && (
                  <p className="mt-1 text-xs text-error-600">
                    ⚠️ Valor excede o orçamento disponível da unidade
                  </p>
                )}
                {noBudget && (
                  <p className="mt-1 text-xs text-error-600">
                    ❌ Unidade sem orçamento válido para o período atual
                  </p>
                )}
              </div>
            </div>
          )}

          <div className="mt-4">
            <label htmlFor="notes" className="block text-sm font-medium text-gray-700 mb-1">
              Observações
            </label>
            <textarea
              id="notes"
              rows={3}
              disabled={isFinalized}
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
            <h3 className="text-lg font-medium text-gray-900">Itens do Pedido</h3>
            {(isNewPurchase || canEditFinancialInfo) && !isFinalized && (
              <Button type="button" variant="outline" onClick={addItem} size="sm">
                + Adicionar Item
              </Button>
            )}
          </div>

          <div className="space-y-4">
            {purchaseItems.map((purchaseItem, index) => (
              <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                {/* Mobile layout */}
                <div className="block sm:hidden space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Item *
                    </label>
                    <select
                      value={purchaseItem.item_id}
                      onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                      disabled={isFinalized || (!isNewPurchase && !canEditFinancialInfo)}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        isFinalized ? 'bg-gray-100' : ''
                      }`}
                    >
                      <option value="">Selecione um item</option>
                      {items.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name} ({item.code})
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Quantidade *
                      </label>
                      <input
                        type="number"
                        min="1"
                        value={purchaseItem.quantity}
                        onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                        disabled={isFinalized || (!isNewPurchase && !canEditFinancialInfo)}
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                          isFinalized ? 'bg-gray-100' : ''
                        }`}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Fornecedor
                      </label>
                      <select
                        value={purchaseItem.supplier_id || ''}
                        onChange={(e) => updateItem(index, 'supplier_id', e.target.value || undefined)}
                        disabled={isFinalized || (!isNewPurchase && !canEditFinancialInfo)}
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                          isFinalized ? 'bg-gray-100' : ''
                        }`}
                      >
                        <option value="">Selecione fornecedor</option>
                        {suppliers.map((supplier) => (
                          <option key={supplier.id} value={supplier.id}>
                            {supplier.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    {canEditFinancialInfo && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preço Unit. (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={purchaseItem.unit_price || ''}
                          onChange={(e) => updateItem(index, 'unit_price', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isFinalized}
                          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                            isFinalized ? 'bg-gray-100' : ''
                          }`}
                        />
                      </div>
                    )}
                  </div>

                  {canEditFinancialInfo && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Total (R$)
                      </label>
                      <input
                        type="text"
                        readOnly
                        value={`R$ ${getItemTotal(purchaseItem).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                        className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm text-sm"
                      />
                    </div>
                  )}

                  {(isNewPurchase || canEditFinancialInfo) && purchaseItems.length > 1 && !isFinalized && (
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
                      value={purchaseItem.item_id}
                      onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                      disabled={isFinalized || (!isNewPurchase && !canEditFinancialInfo)}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        isFinalized ? 'bg-gray-100' : ''
                      }`}
                    >
                      <option value="">Selecione um item</option>
                      {items.map((item) => (
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
                      value={purchaseItem.quantity}
                      onChange={(e) => updateItem(index, 'quantity', Number(e.target.value))}
                      disabled={isFinalized || (!isNewPurchase && !canEditFinancialInfo)}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        isFinalized ? 'bg-gray-100' : ''
                      }`}
                    />
                  </div>

                  <div className="w-40">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Fornecedor
                    </label>
                    <select
                      value={purchaseItem.supplier_id || ''}
                      onChange={(e) => updateItem(index, 'supplier_id', e.target.value || undefined)}
                      disabled={isFinalized || (!isNewPurchase && !canEditFinancialInfo)}
                      className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                        isFinalized ? 'bg-gray-100' : ''
                      }`}
                    >
                      <option value="">Fornecedor</option>
                      {suppliers.map((supplier) => (
                        <option key={supplier.id} value={supplier.id}>
                          {supplier.name}
                        </option>
                      ))}
                    </select>
                  </div>

                  {canEditFinancialInfo && (
                    <>
                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Preço Unit. (R$)
                        </label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={purchaseItem.unit_price || ''}
                          onChange={(e) => updateItem(index, 'unit_price', e.target.value ? Number(e.target.value) : undefined)}
                          disabled={isFinalized}
                          placeholder="0.00"
                          className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                            isFinalized ? 'bg-gray-100' : ''
                          }`}
                        />
                        <p className="mt-1 text-xs text-gray-500">
                          {purchaseItem.unit_price ? 
                            '✅ Preço definido' : 
                            '💡 Será preenchido pela cotação ou digite manualmente'
                          }
                        </p>
                      </div>

                      <div className="w-32">
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                          Total (R$)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={`R$ ${getItemTotal(purchaseItem).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`}
                          className="block w-full rounded-md border-gray-300 bg-gray-100 shadow-sm text-sm"
                        />
                      </div>
                    </>
                  )}

                  {(isNewPurchase || canEditFinancialInfo) && purchaseItems.length > 1 && !isFinalized && (
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

          {/* Total Geral */}
          {canEditFinancialInfo && (
            <div className={`mt-4 p-4 rounded-lg border ${
              budgetExceeded || noBudget ? 'bg-error-50 border-error-200' : 
              isBeingFinalized ? 'bg-yellow-50 border-yellow-200' :
              'bg-primary-50 border-primary-200'
            }`}>
              <div className="flex justify-between items-center">
                <span className="text-base sm:text-lg font-medium text-gray-900">Total Geral:</span>
                <span className={`text-lg sm:text-xl font-bold ${
                  budgetExceeded || noBudget ? 'text-error-600' : 
                  isBeingFinalized ? 'text-yellow-600' :
                  'text-primary-600'
                }`}>
                  R$ {totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {budgetExceeded && (
                <p className="mt-2 text-sm text-error-600">
                  ⚠️ Este valor excede o orçamento disponível da unidade selecionada
                </p>
              )}
              {noBudget && (
                <p className="mt-2 text-sm text-error-600">
                  ❌ Unidade não possui orçamento válido para o período atual
                </p>
              )}
              {isBeingFinalized && !budgetExceeded && !noBudget && (
                <p className="mt-2 text-sm text-yellow-600">
                  🎯 Este valor será debitado do orçamento da unidade ao finalizar
                </p>
              )}
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
              loading={isSubmitting || isFinalizingPurchase} 
              className="w-full sm:w-auto"
              disabled={budgetExceeded || noBudget}
            >
              {isFinalizingPurchase ? 'Finalizando...' : 
               isBeingFinalized ? '🎯 Finalizar Compra' :
               purchase ? 'Atualizar' : 'Criar'} Pedido
            </Button>
          )}
        </div>
      </form>
    </div>
  );
};

export default PurchaseForm;