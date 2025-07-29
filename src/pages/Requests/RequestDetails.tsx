import React, { useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/UI/Badge';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { CheckIcon, XMarkIcon, ShoppingCartIcon } from '@heroicons/react/24/outline';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface RequestDetailsProps {
  request: any;
  onClose: () => void;
  onApprove?: (id: string) => void;
  onReject?: (id: string) => void;
}

interface RequestItemWithDetails {
  id: string;
  quantity_requested: number;
  quantity_approved: number | null;
  quantity_sent: number | null;
  cd_stock_available: number | null;
  needs_purchase: boolean;
  notes: string | null;
  item: {
    code: string;
    name: string;
    unit_measure: string;
  };
}

const RequestDetails: React.FC<RequestDetailsProps> = ({ request, onClose, onApprove, onReject }) => {
  const [requestItems, setRequestItems] = useState<RequestItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  useEffect(() => {
    fetchRequestItems();
  }, [request.id]);

  const fetchRequestItems = async () => {
    try {
      const { data, error } = await supabase
        .from('request_items')
        .select(`
          *,
          item:items(code, name, unit_measure)
        `)
        .eq('request_id', request.id);

      if (error) throw error;
      setRequestItems(data || []);

      // Se for almoxarife, verificar estoque do CD para cada item (apenas do CD vinculado)
      if (profile?.role === 'operador-almoxarife' && profile.unit_id && data) {
        const itemsWithCDStock = await Promise.all(
          data.map(async (item) => {
            // Verificar se o CD do pedido é o mesmo do almoxarife
            if (request.cd_unit_id !== profile.unit_id) {
              return {
                ...item,
                cd_stock_available: 'N/A - CD diferente'
              };
            }

            const { data: cdStock } = await supabase
              .from('cd_stock')
              .select('quantity')
              .eq('item_id', item.item_id)
              .eq('cd_unit_id', profile.unit_id)
              .single();

            return {
              ...item,
              cd_stock_available: cdStock?.quantity || 0
            };
          })
        );
        setRequestItems(itemsWithCDStock);
      }
    } catch (error) {
      console.error('Error fetching request items:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePurchaseFromRequest = async () => {
    if (!profile) {
      toast.error('Usuário não encontrado');
      return;
    }

    const itemsNeedingPurchase = requestItems.filter(item => item.needs_purchase);
    
    if (itemsNeedingPurchase.length === 0) {
      toast.error('Nenhum item marcado como necessário para compra');
      return;
    }

    if (window.confirm(`Criar processo de compra para ${itemsNeedingPurchase.length} item(ns)?`)) {
      try {
        // Criar compra baseada no pedido
        const { data: newPurchase, error: purchaseError } = await supabase
          .from('purchases')
          .insert({
            unit_id: request.cd_unit_id, // CD faz a compra
            requester_id: profile.id,
            status: 'pedido-realizado',
            notes: `Compra criada automaticamente a partir do pedido interno #${request.id.slice(0, 8)}`,
            request_id: request.id, // Vincular ao pedido
          })
          .select()
          .single();

        if (purchaseError) throw purchaseError;

        // Adicionar itens à compra
        const purchaseItems = itemsNeedingPurchase.map(item => ({
          purchase_id: newPurchase.id,
          item_id: item.item.id,
          quantity: item.quantity_requested,
        }));

        const { error: itemsError } = await supabase
          .from('purchase_items')
          .insert(purchaseItems);

        if (itemsError) throw itemsError;

        toast.success(`Processo de compra criado com sucesso! ID: ${newPurchase.id.slice(0, 8)}`);
      } catch (error) {
        console.error('Error creating purchase:', error);
        toast.error('Erro ao criar processo de compra');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'solicitado': { variant: 'info' as const, label: 'Solicitado' },
      'analisando': { variant: 'warning' as const, label: 'Analisando' },
      'aprovado': { variant: 'success' as const, label: 'Aprovado' },
      'rejeitado': { variant: 'error' as const, label: 'Rejeitado' },
      'preparando': { variant: 'info' as const, label: 'Preparando' },
      'enviado': { variant: 'success' as const, label: 'Enviado' },
      'recebido': { variant: 'success' as const, label: 'Recebido' },
      'cancelado': { variant: 'default' as const, label: 'Cancelado' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const getPriorityBadge = (priority: string) => {
    const priorityMap = {
      'baixa': { variant: 'default' as const, label: 'Baixa' },
      'normal': { variant: 'info' as const, label: 'Normal' },
      'alta': { variant: 'warning' as const, label: 'Alta' },
      'urgente': { variant: 'error' as const, label: 'Urgente' },
    };

    const priorityInfo = priorityMap[priority as keyof typeof priorityMap] || { variant: 'default' as const, label: priority };
    return <Badge variant={priorityInfo.variant}>{priorityInfo.label}</Badge>;
  };

  const canApproveReject = onApprove && onReject && ['solicitado', 'analisando'].includes(request.status);
  const canCreatePurchase = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);

  return (
    <div className="space-y-6">
      {/* Status de aprovação/rejeição */}
      {request.status === 'aprovado' && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <CheckIcon className="h-5 w-5 text-green-600 mr-2" />
            <div>
              <h4 className="text-sm font-medium text-green-800">Pedido Aprovado</h4>
              <p className="text-sm text-green-700 mt-1">
                Aprovado por {request.approved_by_profile?.name} em {new Date(request.approved_at).toLocaleDateString('pt-BR')}
              </p>
            </div>
          </div>
        </div>
      )}

      {request.status === 'rejeitado' && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex items-center">
            <XMarkIcon className="h-5 w-5 text-red-600 mr-2" />
            <div>
              <h4 className="text-sm font-medium text-red-800">Pedido Rejeitado</h4>
              <p className="text-sm text-red-700 mt-1">
                Rejeitado por {request.approved_by_profile?.name} em {new Date(request.approved_at).toLocaleDateString('pt-BR')}
              </p>
              {request.rejection_reason && (
                <p className="text-sm text-red-700 mt-1">
                  <strong>Motivo:</strong> {request.rejection_reason}
                </p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Informações Gerais */}
      <Card>
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-lg font-medium text-gray-900">Informações Gerais</h3>
          {canApproveReject && (
            <div className="flex space-x-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => onApprove!(request.id)}
                className="text-green-600 hover:text-green-700"
              >
                <CheckIcon className="w-4 h-4 mr-1" />
                Aprovar
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onReject!(request.id)}
                className="text-red-600 hover:text-red-700"
              >
                <XMarkIcon className="w-4 h-4 mr-1" />
                Rejeitar
              </Button>
            </div>
          )}
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">ID do Pedido</label>
            <p className="mt-1 text-sm text-gray-900 font-mono break-all">{request.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Status</label>
            <div className="mt-1">{getStatusBadge(request.status)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Unidade Solicitante</label>
            <p className="mt-1 text-sm text-gray-900">{request.requesting_unit?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">CD Responsável</label>
            <p className="mt-1 text-sm text-gray-900">{request.cd_unit?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Solicitante</label>
            <p className="mt-1 text-sm text-gray-900">{request.requester?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Prioridade</label>
            <div className="mt-1">{getPriorityBadge(request.priority)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Data de Criação</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(request.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Última Atualização</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(request.updated_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
        
        {request.notes && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-500">Observações</label>
            <p className="mt-1 text-sm text-gray-900">{request.notes}</p>
          </div>
        )}
      </Card>

      {/* Itens do Pedido */}
      <Card>
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-lg font-medium text-gray-900">Itens Solicitados</h3>
          {canCreatePurchase && requestItems.some(item => item.needs_purchase) && (
            <Button
              size="sm"
              variant="outline"
              onClick={handleCreatePurchaseFromRequest}
            >
              <ShoppingCartIcon className="w-4 h-4 mr-1" />
              Criar Compra
            </Button>
          )}
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : requestItems.length === 0 ? (
          <p className="text-gray-500 text-center py-8">Nenhum item encontrado</p>
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Qtd. Solicitada
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Estoque CD
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Observações
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {requestItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.item.name}</div>
                          <div className="text-sm text-gray-500">{item.item.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity_requested} {item.item.unit_measure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.cd_stock_available !== null ? 
                          `${item.cd_stock_available} ${item.item.unit_measure}` : 
                          'Não verificado'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {item.needs_purchase ? (
                          <Badge variant="warning">Precisa Comprar</Badge>
                        ) : (
                          <Badge variant="success">Disponível</Badge>
                        )}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        {item.notes || '-'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-4">
              {requestItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="font-medium text-gray-900">{item.item.name}</div>
                    <div className="text-sm text-gray-500">{item.item.code}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Quantidade:</span>
                      <div className="text-gray-900">{item.quantity_requested} {item.item.unit_measure}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Estoque CD:</span>
                      <div className="text-gray-900">
                        {item.cd_stock_available !== null ? 
                          `${item.cd_stock_available} ${item.item.unit_measure}` : 
                          'Não verificado'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-500">Status:</span>
                      {item.needs_purchase ? (
                        <Badge variant="warning">Precisa Comprar</Badge>
                      ) : (
                        <Badge variant="success">Disponível</Badge>
                      )}
                    </div>
                  </div>
                  
                  {item.notes && (
                    <div className="pt-2 border-t border-gray-100">
                      <span className="font-medium text-gray-500">Observações:</span>
                      <p className="text-gray-900 mt-1">{item.notes}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* Histórico de Ações */}
      {(request.status === 'aprovado' || request.status === 'rejeitado') && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Histórico de Ações</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-primary-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  Pedido {request.status === 'aprovado' ? 'aprovado' : 'rejeitado'} por {request.approved_by_profile?.name}
                </p>
                <span className="text-xs text-gray-400">{new Date(request.approved_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-primary-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  Pedido criado por {request.requester?.name}
                </p>
                <span className="text-xs text-gray-400">{new Date(request.created_at).toLocaleString('pt-BR')}</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default RequestDetails;