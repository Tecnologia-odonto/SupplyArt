import React, { useEffect, useState } from 'react';
import { getTodayBrazilForInput } from '../../utils/dateHelper';
import { CheckIcon, TrophyIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import toast from 'react-hot-toast';

interface QuotationComparisonProps {
  quotation: any;
  onClose: () => void;
  onUpdate: () => void;
}

interface ComparisonData {
  id: string;
  supplier_id: string;
  supplier_name: string;
  unit_price: number;
  total_price: number;
  delivery_time: number | null;
  notes: string | null;
  is_selected: boolean;
}

interface ItemComparisonData {
  item: {
    id: string;
    name: string;
    code: string;
    unit_measure: string;
  };
  quantity: number;
  responses: ComparisonData[];
}

const QuotationComparison: React.FC<QuotationComparisonProps> = ({ quotation, onClose, onUpdate }) => {
  const [itemData, setItemData] = useState<ItemComparisonData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (quotation.selectedItem) {
      fetchItemResponses();
    }
  }, [quotation.id]);

  const fetchItemResponses = async () => {
    try {
      const selectedItem = quotation.selectedItem;
      
      // Buscar todas as respostas para este item específico
      const { data: responses, error: responsesError } = await supabase
        .from('quotation_responses')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('quotation_id', quotation.id)
        .eq('item_id', selectedItem.item.id)
        .order('unit_price', { ascending: true });

      if (responsesError) throw responsesError;

      const formattedResponses = responses?.map(response => ({
        id: response.id,
        supplier_id: response.supplier_id,
        supplier_name: response.supplier?.name || 'Fornecedor não encontrado',
        unit_price: response.unit_price,
        total_price: response.unit_price * selectedItem.quantity,
        delivery_time: response.delivery_time,
        notes: response.notes,
        is_selected: response.is_selected
      })) || [];

      setItemData({
        item: selectedItem.item,
        quantity: selectedItem.quantity,
        responses: formattedResponses
      });
    } catch (error) {
      console.error('Error fetching item responses:', error);
      toast.error('Erro ao carregar dados de comparação');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSupplier = async (responseId: string) => {
    if (!itemData) return;
    
    try {
      setSaving(true);
      
      // Desmarcar todas as seleções para este item
      await supabase
        .from('quotation_responses')
        .update({ is_selected: false })
        .eq('quotation_id', quotation.id)
        .eq('item_id', itemData.item.id);

      // Marcar apenas a selecionada
      const { error } = await supabase
        .from('quotation_responses')
        .update({ is_selected: true })
        .eq('id', responseId);

      if (error) throw error;

      // Buscar dados da resposta selecionada para atualizar a compra
      const selectedResponse = itemData.responses.find(r => r.id === responseId);
      if (selectedResponse) {
        // Buscar o purchase_id através da cotação
        const { data: quotationData, error: quotationError } = await supabase
          .from('quotations')
          .select('purchase_id')
          .eq('id', quotation.id)
          .single();

        if (quotationError) throw quotationError;

        if (quotationData?.purchase_id) {
          // Atualizar o item na tabela purchase_items com o preço selecionado
          const { error: updatePurchaseItemError } = await supabase
            .from('purchase_items')
            .update({
              unit_price: selectedResponse.unit_price,
              total_price: selectedResponse.unit_price * itemData.quantity,
              supplier_id: selectedResponse.supplier_id
            })
            .eq('purchase_id', quotationData.purchase_id)
            .eq('item_id', itemData.item.id);

          if (updatePurchaseItemError) throw updatePurchaseItemError;

          // Recalcular o valor total da compra
          const { data: allPurchaseItems, error: fetchItemsError } = await supabase
            .from('purchase_items')
            .select('total_price')
            .eq('purchase_id', quotationData.purchase_id);

          if (fetchItemsError) throw fetchItemsError;

          const newTotalValue = allPurchaseItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

          // Atualizar valor total da compra
          const { error: updatePurchaseError } = await supabase
            .from('purchases')
            .update({ total_value: newTotalValue })
            .eq('id', quotationData.purchase_id);

          if (updatePurchaseError) throw updatePurchaseError;

          console.log('💰 Updated purchase item prices:', {
            item_id: itemData.item.id,
            unit_price: selectedResponse.unit_price,
            total_price: selectedResponse.unit_price * itemData.quantity,
            supplier_id: selectedResponse.supplier_id,
            new_total_value: newTotalValue
          });

          // Adicionar ao histórico de preços
          const { error: priceHistoryError } = await supabase
            .from('price_history')
            .insert({
              item_id: itemData.item.id,
              item_code: itemData.item.code,
              supplier_id: selectedResponse.supplier_id,
              unit_price: selectedResponse.unit_price,
              quotation_id: quotation.id,
              purchase_date: getTodayBrazilForInput()
            });

          if (priceHistoryError) {
            console.warn('Warning: Could not save to price history:', priceHistoryError);
            // Não falhar por causa do histórico
          }
        }
      }

      // Atualizar dados localmente
      setItemData(prev => prev ? {
        ...prev,
        responses: prev.responses.map(response => ({
          ...response,
          is_selected: response.id === responseId
        }))
      } : null);

      toast.success('Fornecedor selecionado! Preços atualizados no pedido de compra.');
      onUpdate(); // Atualizar a tela principal
    } catch (error) {
      console.error('Error selecting supplier:', error);
      toast.error('Erro ao selecionar fornecedor');
    } finally {
      setSaving(false);
    }
  };

  const handleDeselectSupplier = async (responseId: string) => {
    if (!itemData) return;
    
    try {
      setSaving(true);
      
      // Desmarcar a seleção
      const { error } = await supabase
        .from('quotation_responses')
        .update({ is_selected: false })
        .eq('id', responseId);

      if (error) throw error;

      // Buscar o purchase_id através da cotação para limpar preços
      const { data: quotationData, error: quotationError } = await supabase
        .from('quotations')
        .select('purchase_id')
        .eq('id', quotation.id)
        .single();

      if (quotationError) throw quotationError;

      if (quotationData?.purchase_id) {
        // Limpar preços do item na compra
        const { error: updatePurchaseItemError } = await supabase
          .from('purchase_items')
          .update({
            unit_price: null,
            total_price: null,
            supplier_id: null
          })
          .eq('purchase_id', quotationData.purchase_id)
          .eq('item_id', itemData.item.id);

        if (updatePurchaseItemError) throw updatePurchaseItemError;

        // Recalcular o valor total da compra
        const { data: allPurchaseItems, error: fetchItemsError } = await supabase
          .from('purchase_items')
          .select('total_price')
          .eq('purchase_id', quotationData.purchase_id);

        if (fetchItemsError) throw fetchItemsError;

        const newTotalValue = allPurchaseItems?.reduce((sum, item) => sum + (item.total_price || 0), 0) || 0;

        // Atualizar valor total da compra
        const { error: updatePurchaseError } = await supabase
          .from('purchases')
          .update({ total_value: newTotalValue })
          .eq('id', quotationData.purchase_id);

        if (updatePurchaseError) throw updatePurchaseError;
      }

      // Atualizar dados localmente
      setItemData(prev => prev ? {
        ...prev,
        responses: prev.responses.map(response => ({
          ...response,
          is_selected: response.id === responseId ? false : response.is_selected
        }))
      } : null);

      toast.success('Seleção removida! Preços limpos no pedido de compra.');
      onUpdate(); // Atualizar a tela principal
    } catch (error) {
      console.error('Error deselecting supplier:', error);
      toast.error('Erro ao remover seleção');
    } finally {
      setSaving(false);
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

  if (!itemData) {
    return (
      <div className="text-center py-8 text-gray-500">
        <p>Item não encontrado</p>
      </div>
    );
  }

  const selectedResponse = itemData.responses.find(r => r.is_selected);
  const bestPrice = itemData.responses.length > 0 ? Math.min(...itemData.responses.map(r => r.unit_price)) : null;

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">Todas as Cotações do Item</h3>
          <p className="text-sm text-gray-500">
            {itemData.item.name} ({itemData.item.code}) - {itemData.quantity} {itemData.item.unit_measure}
          </p>
        </div>
        <Button variant="outline" onClick={onClose}>
          Fechar
        </Button>
      </div>

      {/* Resumo */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Total de Cotações</label>
            <p className="text-lg font-semibold text-gray-900">
              {itemData.responses.length}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Fornecedor Selecionado</label>
            <p className="text-lg font-semibold text-gray-900">
              {selectedResponse ? selectedResponse.supplier_name : 'Nenhum'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Melhor Preço</label>
            <p className="text-lg font-semibold text-primary-600">
              {bestPrice ? `R$ ${bestPrice.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Valor Selecionado</label>
            <p className="text-lg font-semibold text-success-600">
              {selectedResponse ? `R$ ${selectedResponse.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : 'N/A'}
            </p>
          </div>
        </div>
      </Card>

      {/* Tabela de Cotações */}
      <Card>
        <h4 className="text-lg font-medium text-gray-900 mb-4">Cotações Recebidas</h4>
        
        {itemData.responses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <p>Nenhuma cotação recebida para este item</p>
            <p className="text-sm mt-2">Use o botão "Nova Cotação" para adicionar cotações de fornecedores</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Fornecedor
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Preço Unit.
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Entrega
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Observações
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Ação
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {itemData.responses.map((response) => (
                  <tr 
                    key={response.id} 
                    className={`
                      ${response.is_selected ? 'bg-success-50 border-success-200' : ''}
                      ${bestPrice && response.unit_price === bestPrice ? 'ring-2 ring-success-200' : ''}
                    `}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center">
                        {bestPrice && response.unit_price === bestPrice && (
                          <TrophyIcon className="w-4 h-4 text-yellow-500 mr-2" />
                        )}
                        <span className="font-medium">{response.supplier_name}</span>
                        {response.is_selected && (
                          <Badge variant="success" size="sm" className="ml-2">Selecionado</Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${
                        bestPrice && response.unit_price === bestPrice ? 'text-success-600' : 'text-gray-900'
                      }`}>
                        R$ {response.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${
                        bestPrice && response.unit_price === bestPrice ? 'text-success-600' : 'text-gray-900'
                      }`}>
                        R$ {response.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {response.delivery_time ? `${response.delivery_time} dias` : '-'}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {response.notes ? (
                        <span title={response.notes}>
                          {response.notes.length > 30 ? `${response.notes.substring(0, 30)}...` : response.notes}
                        </span>
                      ) : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <Button
                        size="sm"
                        variant={response.is_selected ? "success" : "outline"}
                        loading={saving}
                        onClick={() => {
                          if (response.is_selected) {
                            handleDeselectSupplier(response.id);
                          } else {
                            handleSelectSupplier(response.id);
                          }
                        }}
                      >
                        {response.is_selected ? (
                          <>
                            <CheckIcon className="w-3 h-3 mr-1" />
                            Desselecionar
                          </>
                        ) : (
                          'Selecionar'
                        )}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Resumo da Seleção */}
      {selectedResponse && (
        <Card>
          <h4 className="text-lg font-medium text-gray-900 mb-4">✅ Fornecedor Selecionado</h4>
          <div className="bg-success-50 border border-success-200 rounded-lg p-4">
            <div className="flex justify-between items-center">
              <div>
                <div className="font-medium text-gray-900">{selectedResponse.supplier_name}</div>
                <div className="text-sm text-gray-500">
                  {itemData.quantity} {itemData.item.unit_measure} × R$ {selectedResponse.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
                {selectedResponse.delivery_time && (
                  <div className="text-sm text-gray-500">
                    Prazo de entrega: {selectedResponse.delivery_time} dias
                  </div>
                )}
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-success-600">
                  R$ {selectedResponse.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                </div>
              </div>
            </div>
            {selectedResponse.notes && (
              <div className="mt-3 pt-3 border-t border-success-200">
                <div className="text-sm text-gray-700">
                  <strong>Observações:</strong> {selectedResponse.notes}
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};

export default QuotationComparison;