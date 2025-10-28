import React, { useEffect, useState } from 'react';
import { getTodayBrazilForInput } from '../../utils/dateHelper';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Request, Unit, Item } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
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
  status: string;
}

interface RequestItemForm {
  item_id: string;
  quantity_requested: number;
  notes?: string;
}

interface InsufficientStockItem {
  item_id: string;
  item_name: string;
  item_code: string;
  quantity_needed: number;
  cd_stock_available: number;
  quantity_missing: number;
  unit_measure: string;
}

const RequestForm: React.FC<RequestFormProps> = ({ request, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [cdUnits, setCdUnits] = useState<Unit[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [cdStock, setCdStock] = useState<any[]>([]);
  const [unitBudget, setUnitBudget] = useState<any>(null);
  const [availableItems, setAvailableItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [requestItems, setRequestItems] = useState<RequestItemForm[]>([{ item_id: '', quantity_requested: 1 }]);
  const [showInsufficientStockModal, setShowInsufficientStockModal] = useState(false);
  const [insufficientStockItems, setInsufficientStockItems] = useState<InsufficientStockItem[]>([]);
  const [pendingStatusUpdate, setPendingStatusUpdate] = useState<string | null>(null);
  const { profile } = useAuth();

  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      requesting_unit_id: request?.requesting_unit_id || profile?.unit_id || '',
      cd_unit_id: request?.cd_unit_id || '',
      priority: request?.priority || 'normal',
      notes: request?.notes || '',
      status: request?.status || 'solicitado',
    }
  });

  const watchedCdUnitId = watch('cd_unit_id');
  const watchedStatus = watch('status');
  const watchedRequestingUnitId = watch('requesting_unit_id');
  const isNewRequest = !request;
  const canEditStatus = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);
  const canEditItems = !request || ['solicitado', 'analisando'].includes(request.status || '');
  const canChangeStatus = canEditStatus && request && !['aprovado-unidade', 'cancelado'].includes(request.status || '');
  const needsApproval = request && ['solicitado', 'analisando'].includes(request.status);

  useEffect(() => {
    fetchData();
    fetchCdStock();
  }, []);

  useEffect(() => {
    if (watchedRequestingUnitId) {
      fetchUnitBudget(watchedRequestingUnitId);
    }
  }, [watchedRequestingUnitId]);

  useEffect(() => {
    if (request) {
      fetchRequestItems();
    }
  }, [request]);

  useEffect(() => {
    if (watchedCdUnitId) {
      fetchAvailableItems();
    }
  }, [watchedCdUnitId, loading]);

  const fetchData = async () => {
    try {
      const [unitsResult, cdUnitsResult, itemsResult] = await Promise.all([
        supabase.from('units').select('*').eq('is_cd', false).order('name'),
        supabase.from('units').select('*').eq('is_cd', true).order('name'),
        supabase.from('items').select('*').eq('show_in_company', true).order('name')
      ]);

      if (unitsResult.error) throw unitsResult.error;
      if (cdUnitsResult.error) throw cdUnitsResult.error;
      if (itemsResult.error) throw itemsResult.error;

      setUnits(unitsResult.data || []);
      setCdUnits(cdUnitsResult.data || []);
      setItems(itemsResult.data || []);
    } catch (error) {
      console.error('Error fetching data:', error);
      toast.error('Erro ao carregar dados');
    } finally {
      setLoading(false);
    }
  };

  const fetchRequestItems = async () => {
    if (!request) return;

    try {
      const { data, error } = await supabase
        .from('request_items')
        .select(`
          *,
          item:items(id, name, code, unit_measure)
        `)
        .eq('request_id', request.id);

      if (error) throw error;

      if (data && data.length > 0) {
        setRequestItems(data.map(item => ({
          item_id: item.item_id,
          quantity_requested: item.quantity_requested,
          notes: item.notes || undefined
        })));
      }
    } catch (error) {
      console.error('Error fetching request items:', error);
    }
  };

  const fetchAvailableItems = async () => {
    if (!watchedCdUnitId) {
      setAvailableItems([]);
      return;
    }

    try {
      // Para pedidos existentes, buscar todos os itens (não apenas os com estoque)
      // Para novos pedidos, buscar apenas itens com estoque
      let query;
      
      if (request) {
        // Pedido existente: mostrar todos os itens que aparecem na empresa
        query = supabase
          .from('items')
          .select('id, name, code, unit_measure, show_in_company')
          .eq('show_in_company', true);
      } else {
        // Novo pedido: apenas itens com estoque no CD
        query = supabase
          .from('cd_stock')
          .select(`
            item_id,
            quantity,
            item:items(id, name, code, unit_measure, show_in_company)
          `)
          .eq('cd_unit_id', watchedCdUnitId)
          .gt('quantity', 0);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      
      let itemsWithStock;
      
      if (request) {
        // Para pedidos existentes, buscar estoque separadamente
        itemsWithStock = await Promise.all((data || []).map(async (item) => {
          const { data: stockData } = await supabase
            .from('cd_stock')
            .select('quantity, unit_price')
            .eq('item_id', item.id)
            .eq('cd_unit_id', watchedCdUnitId)
            .maybeSingle();
          
          return {
            ...item,
            cd_stock_quantity: stockData?.quantity || 0,
            cd_unit_price: stockData?.unit_price || 0
          };
        }));
      } else {
        // Para novos pedidos, os dados já vêm com estoque
        const itemsWithPrices = await Promise.all((data || []).map(async (stockItem) => {
          const { data: priceData } = await supabase
            .from('cd_stock')
            .select('unit_price')
            .eq('item_id', stockItem.item.id)
            .eq('cd_unit_id', watchedCdUnitId)
            .maybeSingle();

          return {
          id: stockItem.item.id,
          name: stockItem.item.name,
          code: stockItem.item.code,
          unit_measure: stockItem.item.unit_measure,
          cd_stock_quantity: stockItem.quantity,
          cd_unit_price: priceData?.unit_price || 0
          };
        }));
        
        itemsWithStock = itemsWithPrices;
      }
      
      setAvailableItems(itemsWithStock);
    } catch (error) {
      console.error('Error fetching available items:', error);
      toast.error('Erro ao carregar itens disponíveis');
    }
  };

  const checkStockAvailability = async (targetStatus: string) => {
    if (!request || targetStatus !== 'enviado') return true;

    try {
      // Buscar itens do pedido
      const { data: requestItemsData, error: itemsError } = await supabase
        .from('request_items')
        .select(`
          *,
          item:items(id, name, code, unit_measure)
        `)
        .eq('request_id', request.id);

      if (itemsError) throw itemsError;

      if (!requestItemsData || requestItemsData.length === 0) {
        toast.error('Nenhum item encontrado no pedido');
        return false;
      }

      const insufficientItems: InsufficientStockItem[] = [];

      // Verificar estoque para cada item
      for (const requestItem of requestItemsData) {
        const quantityNeeded = requestItem.quantity_approved || requestItem.quantity_requested;

        const { data: stockData, error: stockError } = await supabase
          .from('cd_stock')
          .select('quantity')
          .eq('item_id', requestItem.item_id)
          .eq('cd_unit_id', watchedCdUnitId)
          .maybeSingle();

        if (stockError) throw stockError;

        const availableStock = stockData?.quantity || 0;

        if (quantityNeeded > availableStock) {
          insufficientItems.push({
            item_id: requestItem.item_id,
            item_name: requestItem.item.name,
            item_code: requestItem.item.code,
            quantity_needed: quantityNeeded,
            cd_stock_available: availableStock,
            quantity_missing: quantityNeeded - availableStock,
            unit_measure: requestItem.item.unit_measure
          });
        }
      }

      if (insufficientItems.length > 0) {
        // Processar envio do pedido (criar registros em_rota)
        await processRequestSending(request?.id || requestId, data.cd_unit_id, data.requesting_unit_id);
      }

      if (insufficientItems.length > 0) {
        setInsufficientStockItems(insufficientItems);
        setPendingStatusUpdate(targetStatus);
        setShowInsufficientStockModal(true);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error checking stock availability:', error);
      toast.error('Erro ao verificar estoque');
      return false;
    }
  };

  const handleCreatePurchaseForMissingItems = async () => {
    if (!profile || insufficientStockItems.length === 0) return;

    try {
      // Criar compra para os itens em falta
      const { data: newPurchase, error: purchaseError } = await supabase
        .from('purchases')
        .insert({
          unit_id: watchedCdUnitId,
          requester_id: profile.id,
          status: 'pedido-realizado',
          notes: `Compra criada automaticamente para envio do pedido #${request?.id.slice(0, 8)} - Estoque insuficiente no CD`,
          request_id: request?.id,
        })
        .select()
        .single();

      if (purchaseError) throw purchaseError;

      // Adicionar itens à compra (apenas a quantidade faltante)
      const purchaseItems = insufficientStockItems.map(item => ({
        purchase_id: newPurchase.id,
        item_id: item.item_id,
        quantity: item.quantity_missing, // Apenas a quantidade que falta
      }));

      const { error: itemsError } = await supabase
        .from('purchase_items')
        .insert(purchaseItems);

      if (itemsError) throw itemsError;

      // Atualizar status do pedido para aprovado-pendente
      const { error: statusError } = await supabase
        .from('requests')
        .update({ status: 'aprovado-pendente' })
        .eq('id', request?.id);

      if (statusError) throw statusError;

      setShowInsufficientStockModal(false);
      setPendingStatusUpdate(null);
      setInsufficientStockItems([]);
      
      toast.success(`Pedido de compra criado! ID: ${newPurchase.id.slice(0, 8)}. Pedido ficará pendente até a compra ser finalizada.`);
      onSave();
    } catch (error) {
      console.error('Error creating purchase:', error);
      toast.error('Erro ao criar pedido de compra');
    }
  };

  const handleAdjustRequest = () => {
    setShowInsufficientStockModal(false);
    setPendingStatusUpdate(null);
    setInsufficientStockItems([]);
    toast('Ajuste as quantidades dos itens ou adicione observações explicando a situação');
  };

  const handleCancelStatusChange = () => {
    setShowInsufficientStockModal(false);
    setPendingStatusUpdate(null);
    setInsufficientStockItems([]);
    // Reverter o status para o valor anterior
    setValue('status', request?.status || 'solicitado');
  };

  const processRequestSending = async (requestId: string, cdUnitId: string, requestingUnitId: string) => {
    try {
      console.log('🚚 Starting processRequestSending for request:', requestId);
      
      // Verificar se já existem registros em_rota para este pedido
      const { data: existingEmRota, error: checkError } = await supabase
        .from('em_rota')
        .select('id')
        .eq('request_id', requestId);

      if (checkError) throw checkError;

      if (existingEmRota && existingEmRota.length > 0) {
        console.log('🚚 Request already has em_rota records, skipping processing');
        toast.info('Este pedido já foi enviado anteriormente');
        return;
      }

      // Buscar dados do pedido para preservar o custo total
      const { data: requestData, error: requestFetchError } = await supabase
        .from('requests')
        .select('total_estimated_cost')
        .eq('id', requestId)
        .single();

      if (requestFetchError) throw requestFetchError;
      
      const originalTotalCost = requestData.total_estimated_cost || 0;
      console.log('💰 Preserving original total cost:', originalTotalCost);

      // Buscar itens do pedido
      const { data: requestItems, error: itemsError } = await supabase
        .from('request_items')
        .select('*')
        .eq('request_id', requestId);

      if (itemsError) throw itemsError;

      if (!requestItems || requestItems.length === 0) {
        toast.error('Nenhum item encontrado no pedido');
        return;
      }

      console.log('🚚 Processing', requestItems.length, 'items for sending');

      // Para cada item, criar registro em em_rota e atualizar estoques
      for (const item of requestItems) {
        const quantityToSend = item.quantity_approved || item.quantity_requested;
        
        console.log('🚚 Processing item:', {
          item_id: item.item_id,
          quantity_to_send: quantityToSend
        });

        // Verificar estoque no CD
        const { data: cdStock, error: stockError } = await supabase
          .from('cd_stock')
          .select('quantity')
          .eq('item_id', item.item_id)
          .eq('cd_unit_id', cdUnitId)
          .maybeSingle();

        if (stockError) throw stockError;

        const availableStock = cdStock?.quantity || 0;
        console.log('🚚 CD Stock check:', {
          available: availableStock,
          needed: quantityToSend
        });
        
        if (quantityToSend > availableStock) {
          console.error('🚚 Insufficient stock for item:', item.item_id);
          toast.error(`Estoque insuficiente: disponível ${availableStock}, necessário ${quantityToSend}`);
          continue;
        }

        // Criar registro em em_rota
        const { error: emRotaError } = await supabase
          .from('em_rota')
          .insert({
            item_id: item.item_id,
            from_cd_unit_id: cdUnitId,
            to_unit_id: requestingUnitId,
            quantity: quantityToSend,
            request_id: requestId,
            status: 'em_transito',
            notes: `Enviado via pedido interno #${requestId.slice(0, 8)}`
          });

        if (emRotaError) throw emRotaError;
        
        console.log('🚚 Created em_rota record for item:', item.item_id);

        // Subtrair do estoque do CD
        const { error: updateStockError } = await supabase
          .from('cd_stock')
          .update({
            quantity: availableStock - quantityToSend
          })
          .eq('item_id', item.item_id)
          .eq('cd_unit_id', cdUnitId);

        if (updateStockError) throw updateStockError;
        
        console.log('🚚 Updated CD stock for item:', item.item_id);

        // Atualizar quantity_sent no request_item
        const { error: updateItemError } = await supabase
          .from('request_items')
          .update({
            quantity_sent: quantityToSend
          })
          .eq('id', item.id);

        if (updateItemError) throw updateItemError;
        
        console.log('🚚 Updated request_item quantity_sent for:', item.id);
      }

      // IMPORTANTE: Preservar o custo total original do pedido
      const { error: preserveCostError } = await supabase
        .from('requests')
        .update({
          total_estimated_cost: originalTotalCost
        })
        .eq('id', requestId);

      if (preserveCostError) {
        console.error('Error preserving total cost:', preserveCostError);
        // Não falhar o processo por causa disso, apenas logar
      } else {
        console.log('💰 Successfully preserved total cost:', originalTotalCost);
      }

      console.log('🚚 Request sending completed successfully');
      toast.success('🚚 Pedido enviado! Itens adicionados à rota de entrega.');
    } catch (error) {
      console.error('Error processing request sending:', error);
      toast.error('Erro ao processar envio do pedido');
      throw error;
    }
  };

  const fetchCdStock = async () => {
    try {
      const { data, error } = await supabase
        .from('cd_stock')
        .select(`
          *,
          items:item_id (
            id,
            code,
            name,
            unit_measure
          ),
          units:cd_unit_id (
            id,
            name
          )
        `)
        .gt('quantity', 0);

      if (error) throw error;
      setCdStock(data || []);
    } catch (error) {
      console.error('Error fetching CD stock:', error);
      toast.error('Erro ao carregar estoque do CD');
    }
  };

  const fetchUnitBudget = async (unitId: string) => {
    try {
      const today = getTodayBrazilForInput();
      console.log('📅 Fetching budget for unit:', unitId, 'on date:', today);

      const { data, error } = await supabase
        .from('unit_budgets')
        .select('*')
        .eq('unit_id', unitId)
        .lte('period_start', today)
        .gte('period_end', today)
        .maybeSingle();

      if (error) {
        console.error('❌ Error fetching budget:', error);
        throw error;
      }

      if (data) {
        console.log('✅ Budget found:', data);
      } else {
        console.warn('⚠️ No budget found for unit on this date');
      }

      setUnitBudget(data);
    } catch (error) {
      console.error('Error fetching unit budget:', error);
    }
  };

  const addItem = () => {
    // Verificar se a unidade tem orçamento antes de permitir adicionar itens
    if (!unitBudget) {
      toast.error('Esta unidade não possui orçamento configurado. Configure o orçamento no módulo financeiro antes de fazer pedidos.');
      return;
    }

    setRequestItems([...requestItems, { item_id: '', quantity_requested: 1 }]);
  };

  const removeItem = (index: number) => {
    if (requestItems.length > 1) {
      setRequestItems(requestItems.filter((_, i) => i !== index));
    }
  };

  const updateItem = (index: number, field: string, value: any) => {
    const updated = [...requestItems];
    
    if (field === 'item_id') {
      // Buscar preço do item no estoque do CD
      const stockItem = cdStock.find(stock => stock.item_id === value);
      if (stockItem) {
        updated[index] = { 
          ...updated[index], 
          [field]: value,
          estimated_unit_price: stockItem.unit_price || 0
        };
        updated[index].estimated_total_price = (stockItem.unit_price || 0) * updated[index].quantity_requested;
      } else {
        updated[index] = { ...updated[index], [field]: value };
      }
    } else if (field === 'quantity_requested') {
      const quantity = parseFloat(value) || 0;
      updated[index] = { 
        ...updated[index], 
        [field]: quantity,
        estimated_total_price: (updated[index].estimated_unit_price || 0) * quantity
      };
    } else {
      updated[index] = { ...updated[index], [field]: value };
    }
    
    setRequestItems(updated);
  };

  const onSubmit = async (data: FormData) => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    // Validar se há pelo menos um item
    const validItems = requestItems.filter(item => item.item_id && item.quantity_requested > 0);

    if (validItems.length === 0 && isNewRequest) {
      toast.error('Adicione pelo menos um item ao pedido');
      return;
    }

    // Calcular custo total (necessário tanto para novos quanto para atualizações)
    const totalCost = getTotalEstimatedCost();

    // Verificar orçamento antes de criar o pedido
    if (isNewRequest) {
      console.log('🔍 Checking budget for new request...');
      console.log('Unit budget:', unitBudget);

      if (!unitBudget) {
        console.error('❌ No budget configured');
        toast.error('Esta unidade não possui orçamento configurado. Configure o orçamento no módulo financeiro antes de fazer pedidos.');
        return;
      }

      console.log('💵 Total cost:', totalCost, 'Available:', unitBudget.available_amount);

      if (totalCost > unitBudget.available_amount) {
        console.error('❌ Insufficient budget');
        toast.error(`Orçamento insuficiente. Custo estimado: R$ ${totalCost.toFixed(2)}, Disponível: R$ ${unitBudget.available_amount.toFixed(2)}`);
        return;
      }

      console.log('✅ Budget check passed');
    }

    // Se estiver tentando mudar para "enviado", verificar estoque
    if (data.status === 'enviado' && request?.status !== 'enviado') {
      const hasStock = await checkStockAvailability(data.status);
      if (!hasStock) {
        return; // Modal será exibido, aguardar ação do usuário
      }
    }

    try {
      const oldValues = request ? { ...request } : null;
      
      const requestData = {
        requesting_unit_id: data.requesting_unit_id,
        cd_unit_id: data.cd_unit_id,
        requester_id: profile.id,
        total_estimated_cost: totalCost,
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

        // Criar log de auditoria
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
          .maybeSingle();

        if (error) throw error;
        requestId = newRequest.id;

        // Criar log de auditoria
        await createAuditLog({
          action: 'REQUEST_CREATED',
          tableName: 'requests',
          recordId: newRequest.id,
          newValues: requestData
        });
      }

      // Inserir/atualizar itens do pedido (apenas se puder editar)
      if (canEditItems) {
        // Remover itens existentes se for uma edição
        if (request) {
          await supabase
            .from('request_items')
            .delete()
            .eq('request_id', request.id);
        }

        // Inserir novos itens com preços estimados do CD
        const itemsToInsert = await Promise.all(validItems.map(async (item) => {
          // Buscar preço do item no CD
          const { data: cdStockData } = await supabase
            .from('cd_stock')
            .select('unit_price')
            .eq('item_id', item.item_id)
            .eq('cd_unit_id', data.cd_unit_id)
            .maybeSingle();
          
          const unitPrice = cdStockData?.unit_price || 0;
          const totalPrice = unitPrice * item.quantity_requested;
          
          return {
          request_id: requestId,
          item_id: item.item_id,
          quantity_requested: Number(item.quantity_requested),
          estimated_unit_price: unitPrice,
          estimated_total_price: totalPrice,
          notes: item.notes || null,
          };
        }));

        const { error: itemsError } = await supabase
          .from('request_items')
          .insert(itemsToInsert);

        if (itemsError) throw itemsError;

        // Recalcular e atualizar o total estimado do pedido
        const newTotalCost = itemsToInsert.reduce((sum, item) => sum + item.estimated_total_price, 0);
        
        const { error: updateTotalError } = await supabase
          .from('requests')
          .update({ total_estimated_cost: newTotalCost })
          .eq('id', requestId);

        if (updateTotalError) throw updateTotalError;
        
        console.log('Updated request total cost:', newTotalCost);
      }

      // Processar envio do pedido (criar registros em_rota)
      if (data.status === 'enviado' && request?.status !== 'enviado') {
        console.log('🚚 Processing request sending for status change to "enviado"');
        await processRequestSending(requestId, data.cd_unit_id, data.requesting_unit_id);
      }

      toast.success(request ? 'Pedido atualizado com sucesso!' : 'Pedido criado com sucesso!');
      onSave();
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
    { value: 'analisando', label: 'Analisando', description: 'Verificando disponibilidade no CD' },
    { value: 'aprovado', label: 'Aprovado', description: 'Pedido aprovado e pronto para envio' },
    { value: 'aprovado-pendente', label: 'Aprovado - Compra Pendente', description: 'Aprovado mas aguardando compra' },
    { value: 'rejeitado', label: 'Rejeitado', description: 'Pedido rejeitado' },
    { value: 'preparando', label: 'Preparando', description: 'Separando itens no CD' },
    { value: 'enviado', label: 'Enviado', description: 'Itens enviados para a unidade' },
    { value: 'recebido', label: 'Recebido', description: 'Itens recebidos na unidade' },
    { value: 'aprovado-unidade', label: 'Aprovado pela Unidade', description: 'Confirmação final de recebimento' },
    { value: 'erro-pedido', label: 'Erro no Pedido', description: 'Problema identificado no pedido' },
    { value: 'cancelado', label: 'Cancelado', description: 'Pedido cancelado' },
  ];

  const getTotalEstimatedCost = () => {
    const total = requestItems.reduce((sum, item) => {
      const itemTotal = item.estimated_total_price || 0;
      return sum + itemTotal;
    }, 0);
    console.log('💰 Total estimated cost:', total, 'from', requestItems.length, 'items');
    return total;
  };

  const totalEstimatedCost = getTotalEstimatedCost();
  const hasBudget = unitBudget !== null;
  const budgetSufficient = hasBudget && totalEstimatedCost <= unitBudget.available_amount;
  const budgetExceeded = hasBudget && totalEstimatedCost > unitBudget.available_amount;

  return (
    <div className="max-w-4xl mx-auto">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
        {/* Alerta de Orçamento */}
        {watchedRequestingUnitId && !hasBudget && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-red-600 text-xl">❌</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Sem Orçamento Configurado</h3>
                <p className="text-sm text-red-700 mt-1">
                  A unidade selecionada não possui orçamento configurado para o período atual. 
                  Configure um orçamento no módulo financeiro antes de criar pedidos.
                </p>
              </div>
            </div>
          </div>
        )}

        {watchedRequestingUnitId && hasBudget && budgetExceeded && totalEstimatedCost > 0 && (
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-yellow-600 text-xl">⚠️</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Orçamento Insuficiente</h3>
                <p className="text-sm text-yellow-700 mt-1">
                  O custo estimado do pedido (R$ {totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}) 
                  excede o orçamento disponível da unidade (R$ {unitBudget.available_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}).
                </p>
              </div>
            </div>
          </div>
        )}

        {watchedRequestingUnitId && hasBudget && budgetSufficient && totalEstimatedCost > 0 && (
          <div className="bg-green-50 border border-green-200 rounded-md p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <span className="text-green-600 text-xl">✅</span>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-green-800">Orçamento Suficiente</h3>
                <p className="text-sm text-green-700 mt-1">
                  Orçamento disponível: R$ {unitBudget.available_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                  Custo do pedido: R$ {totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} | 
                  Restará: R$ {(unitBudget.available_amount - totalEstimatedCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Informações Básicas */}
        <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
          <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Básicas</h3>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label htmlFor="requesting_unit_id" className="block text-sm font-medium text-gray-700 mb-1">
                Unidade Solicitante *
              </label>
              <select
                id="requesting_unit_id"
                disabled={!isNewRequest}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  errors.requesting_unit_id ? 'border-error-300' : ''
                } ${!isNewRequest ? 'bg-gray-100' : ''}`}
                {...register('requesting_unit_id', { required: 'Unidade solicitante é obrigatória' })}
              >
                <option value="">Selecione uma unidade</option>
                {units.map((unit) => (
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
                disabled={!isNewRequest}
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                  errors.cd_unit_id ? 'border-error-300' : ''
                } ${!isNewRequest ? 'bg-gray-100' : ''}`}
                {...register('cd_unit_id', { required: 'Centro de distribuição é obrigatório' })}
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
            </div>
          </div>

          {canEditStatus && canChangeStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade *
                </label>
                <select
                  id="priority"
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                    errors.priority ? 'border-error-300' : ''
                  }`}
                  {...register('priority', { required: 'Prioridade é obrigatória' })}
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
                {errors.priority && (
                  <p className="mt-1 text-sm text-error-600">{errors.priority.message}</p>
                )}
              </div>

              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Status *
                </label>
                <select
                  id="status"
                  disabled={needsApproval}
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                    needsApproval ? 'bg-gray-100' : ''
                  }`}
                  {...register('status')}
                >
                  {statusOptions
                    .filter(option => {
                      // Se precisa aprovação, mostrar apenas status atual
                      if (needsApproval) {
                        return option.value === request?.status;
                      }
                      // Se já foi aprovado/rejeitado, permitir apenas status posteriores
                      if (request?.status === 'aprovado') {
                        return ['aprovado', 'preparando', 'enviado', 'erro-pedido'].includes(option.value);
                      }
                      if (request?.status === 'rejeitado') {
                        return ['rejeitado'].includes(option.value);
                      }
                      return true;
                    })
                    .map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  {needsApproval 
                    ? 'Pedido precisa ser aprovado/rejeitado antes de alterar status'
                    : statusOptions.find(opt => opt.value === watchedStatus)?.description
                  }
                </p>
              </div>
            </div>
          )}

          {!canEditStatus && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
              <div>
                <label htmlFor="priority" className="block text-sm font-medium text-gray-700 mb-1">
                  Prioridade *
                </label>
                <select
                  id="priority"
                  className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                    errors.priority ? 'border-error-300' : ''
                  }`}
                  {...register('priority', { required: 'Prioridade é obrigatória' })}
                >
                  <option value="baixa">Baixa</option>
                  <option value="normal">Normal</option>
                  <option value="alta">Alta</option>
                  <option value="urgente">Urgente</option>
                </select>
                {errors.priority && (
                  <p className="mt-1 text-sm text-error-600">{errors.priority.message}</p>
                )}
              </div>
            </div>
          )}

          {/* Alerta para pedidos que precisam aprovação */}
          {needsApproval && (
            <div className="mt-4 bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-start">
                <div>
                  <span className="text-yellow-600 text-xl">⏳</span>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Aguardando Aprovação</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Este pedido precisa ser aprovado ou rejeitado por um Gestor ou Operador Almoxarife antes que o status possa ser alterado.
                  </p>
                </div>
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
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
              {...register('notes')}
            />
          </div>
        </div>

        {/* Itens do Pedido */}
        {(canEditItems || request) && (
          <div className="bg-white p-4 sm:p-6 rounded-lg border border-gray-200">
            <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 space-y-2 sm:space-y-0">
              <h3 className="text-lg font-medium text-gray-900">Itens do Pedido</h3>
              {canEditItems && (
                <Button type="button" variant="outline" onClick={addItem} size="sm">
                  + Adicionar Item
                </Button>
              )}
            </div>

            {!watchedRequestingUnitId && (
              <div className="mb-4 p-3 bg-blue-50 border border-blue-200 rounded-md">
                <p className="text-sm text-blue-700">
                  💡 Selecione uma unidade solicitante para verificar o orçamento disponível
                </p>
              </div>
            )}

            {!watchedCdUnitId && (
              <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-md">
                <p className="text-sm text-yellow-700">
                  ⚠️ Selecione um Centro de Distribuição para ver os itens disponíveis
                </p>
              </div>
            )}

            <div className="space-y-4">
              {requestItems.map((requestItem, index) => (
                <div key={index} className="p-4 border border-gray-200 rounded-lg bg-gray-50">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        Item *
                      </label>
                      <select
                        value={requestItem.item_id}
                        onChange={(e) => updateItem(index, 'item_id', e.target.value)}
                        disabled={!watchedCdUnitId || !canEditItems || !hasBudget}
                        className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm ${
                          !watchedCdUnitId || !canEditItems || !hasBudget ? 'bg-gray-100' : ''
                        }`}
                      >
                        <option value="">
                          {!watchedCdUnitId ? 'Selecione um CD primeiro' : 
                           !hasBudget ? 'Configure orçamento da unidade primeiro' : 
                           'Selecione um item'}
                        </option>
                        {(request ? items : availableItems).map((item) => (
                          <option key={item.id} value={item.id}>
                            {item.name} ({item.code})
                            {item.cd_stock_quantity !== undefined && ` - Estoque: ${item.cd_stock_quantity} ${item.unit_measure}`}
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
                        disabled={!canEditItems || !hasBudget}
                        className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                      />
                    </div>

                    {requestItems.length > 1 && canEditItems && (
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

                  <div className="mt-4">
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      Observações do Item
                    </label>
                    <input
                      type="text"
                      value={requestItem.notes || ''}
                      onChange={(e) => updateItem(index, 'notes', e.target.value)}
                      placeholder="Observações específicas deste item..."
                      disabled={!canEditItems || !hasBudget}
                      className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {requestItems.length > 0 && (
          <div className={`border rounded-lg p-4 ${
            !hasBudget ? 'bg-red-50 border-red-200' :
            budgetExceeded ? 'bg-yellow-50 border-yellow-200' :
            'bg-gray-50 border-gray-200'
          }`}>
            <h3 className="text-sm font-medium text-gray-800 mb-3">Resumo do Pedido</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span>Total de itens:</span>
                <span className="font-medium">{requestItems.length}</span>
              </div>
              <div className="flex justify-between">
                <span>Custo total estimado:</span>
                <span className={`font-medium ${budgetExceeded ? 'text-red-600' : 'text-gray-900'}`}>
                  R$ {totalEstimatedCost.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </span>
              </div>
              {unitBudget && (
                <>
                  <div className="flex justify-between">
                    <span>Orçamento disponível:</span>
                    <span className="font-medium text-blue-600">
                      R$ {unitBudget.available_amount.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span>Orçamento após pedido:</span>
                    <span className={`font-medium ${
                      (unitBudget.available_amount - totalEstimatedCost) >= 0 
                        ? 'text-green-600' 
                        : 'text-red-600'
                    }`}>
                      R$ {(unitBudget.available_amount - totalEstimatedCost).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                </>
              )}
              {!hasBudget && (
                <div className="flex justify-between">
                  <span>Status do orçamento:</span>
                  <span className="font-medium text-red-600">❌ Não configurado</span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Botões de Ação */}
        <div className="flex flex-col sm:flex-row justify-end space-y-3 sm:space-y-0 sm:space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel} className="w-full sm:w-auto">
            Cancelar
          </Button>
          <Button 
            type="submit" 
            loading={isSubmitting} 
            disabled={!hasBudget || budgetExceeded}
            className="w-full sm:w-auto"
          >
            {request ? 'Atualizar' : 'Criar'} Pedido
          </Button>
        </div>
      </form>

      {/* Modal de Estoque Insuficiente */}
      <Modal
        isOpen={showInsufficientStockModal}
        onClose={handleCancelStatusChange}
        title="⚠️ Estoque Insuficiente no CD"
        size="lg"
      >
        <div className="space-y-4">
          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
            <h4 className="text-sm font-medium text-yellow-800 mb-2">Não é possível enviar o pedido</h4>
            <p className="text-xs text-yellow-700">
              Alguns itens não possuem estoque suficiente no Centro de Distribuição para atender este pedido.
              Escolha uma das opções abaixo:
            </p>
          </div>

          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Item</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Necessário</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Disponível</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Faltando</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {insufficientStockItems.map((item) => (
                  <tr key={item.item_id} className="bg-yellow-50">
                    <td className="px-4 py-3">
                      <div>
                        <div className="text-sm font-medium text-gray-900">{item.item_name}</div>
                        <div className="text-xs text-gray-500">{item.item_code}</div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.quantity_needed} {item.unit_measure}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {item.cd_stock_available} {item.unit_measure}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-red-600">
                      {item.quantity_missing} {item.unit_measure}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="space-y-3">
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-blue-800 mb-2">🛒 Opção 1: Criar Pedido de Compra</h5>
              <p className="text-xs text-blue-700 mb-3">
                Criar automaticamente um pedido de compra apenas para as quantidades em falta.
                O pedido ficará com status "Aprovado-Pendente" até a compra ser finalizada.
              </p>
              <Button
                onClick={handleCreatePurchaseForMissingItems}
                className="w-full"
              >
                🛒 Criar Pedido de Compra para Itens em Falta
              </Button>
            </div>

            <div className="bg-orange-50 border border-orange-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-orange-800 mb-2">📝 Opção 2: Ajustar Pedido</h5>
              <p className="text-xs text-orange-700 mb-3">
                Voltar ao formulário para diminuir as quantidades dos itens ou adicionar observações
                explicando a situação para o solicitante.
              </p>
              <Button
                variant="outline"
                onClick={handleAdjustRequest}
                className="w-full"
              >
                📝 Ajustar Quantidades/Observações
              </Button>
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-gray-800 mb-2">❌ Opção 3: Cancelar</h5>
              <p className="text-xs text-gray-700 mb-3">
                Cancelar a alteração de status e manter o pedido no status atual.
              </p>
              <Button
                variant="outline"
                onClick={handleCancelStatusChange}
                className="w-full"
              >
                ❌ Cancelar Alteração de Status
              </Button>
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default RequestForm;