import React, { useEffect, useState } from 'react';
import { formatDBDateForDisplay } from '../../utils/dateHelper';
import { supabase } from '../../lib/supabase';
import Badge from '../../components/UI/Badge';
import Card from '../../components/UI/Card';

interface PurchaseDetailsProps {
  purchase: any;
  onClose: () => void;
}

interface PurchaseItemWithDetails {
  id: string;
  quantity: number;
  unit_price: number | null;
  total_price: number | null;
  supplier: {
    name: string;
  } | null;
  item: {
    code: string;
    name: string;
    unit_measure: string;
  };
}

const PurchaseDetails: React.FC<PurchaseDetailsProps> = ({ purchase, onClose }) => {
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItemWithDetails[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchPurchaseItems();
  }, [purchase.id]);

  const fetchPurchaseItems = async () => {
    try {
      const { data, error } = await supabase
        .from('purchase_items')
        .select(`
          *,
          supplier:suppliers(name),
          item:items(code, name, unit_measure)
        `)
        .eq('purchase_id', purchase.id);

      if (error) throw error;
      setPurchaseItems(data || []);
    } catch (error) {
      console.error('Error fetching purchase items:', error);
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap = {
      'pedido-realizado': { variant: 'info' as const, label: 'Pedido Realizado' },
      'em-cotacao': { variant: 'warning' as const, label: 'Em Cotação' },
      'comprado-aguardando': { variant: 'info' as const, label: 'Comprado - Aguardando' },
      'chegou-cd': { variant: 'success' as const, label: 'Chegou ao CD' },
      'enviado': { variant: 'success' as const, label: 'Enviado' },
      'erro-pedido': { variant: 'error' as const, label: 'Erro no Pedido' },
      'finalizado': { variant: 'success' as const, label: 'Finalizado' },
    };

    const statusInfo = statusMap[status as keyof typeof statusMap] || { variant: 'default' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  const totalValue = purchaseItems.reduce((sum, item) => {
    return sum + (item.total_price || 0);
  }, 0);

  const isFinalized = purchase.status === 'finalizado';

  return (
    <div className="space-y-6">
      {/* Status de finalização */}
      {isFinalized && (
        <div className="bg-green-50 border border-green-200 rounded-md p-4">
          <div className="flex items-center">
            <span className="text-green-600 text-xl mr-3">✅</span>
            <div>
              <h4 className="text-sm font-medium text-green-800">Compra Finalizada</h4>
              <p className="text-sm text-green-700 mt-1">
                Esta compra foi finalizada e os itens foram automaticamente adicionados ao estoque da unidade.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Informações Gerais */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informações Gerais</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">ID do Pedido</label>
            <p className="mt-1 text-sm text-gray-900 font-mono break-all">{purchase.id}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Status</label>
            <div className="mt-1">{getStatusBadge(purchase.status)}</div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Unidade</label>
            <p className="mt-1 text-sm text-gray-900">{purchase.unit?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Solicitante</label>
            <p className="mt-1 text-sm text-gray-900">{purchase.requester?.name}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Fornecedor</label>
            <p className="mt-1 text-sm text-gray-900">{purchase.supplier?.name || 'Não definido'}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Data de Criação</label>
            <p className="mt-1 text-sm text-gray-900">
              {formatDBDateForDisplay(purchase.created_at)}
            </p>
          </div>
          {purchase.updated_at !== purchase.created_at && (
            <div>
              <label className="block text-sm font-medium text-gray-500">Última Atualização</label>
              <p className="mt-1 text-sm text-gray-900">
                {formatDBDateForDisplay(purchase.updated_at)}
              </p>
            </div>
          )}
        </div>
        
        {purchase.notes && (
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-500">Observações</label>
            <p className="mt-1 text-sm text-gray-900">{purchase.notes}</p>
          </div>
        )}
      </Card>

      {/* Itens do Pedido */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Itens do Pedido</h3>
        {loading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-600"></div>
          </div>
        ) : purchaseItems.length === 0 ? (
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
                      Fornecedor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Quantidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Preço Unitário
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Total
                    </th>
                    {isFinalized && (
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Status
                      </th>
                    )}
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {purchaseItems.map((item) => (
                    <tr key={item.id}>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{item.item.name}</div>
                          <div className="text-sm text-gray-500">{item.item.code}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.supplier?.name || '-'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.quantity} {item.item.unit_measure}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.unit_price 
                          ? `R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'
                        }
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {item.total_price 
                          ? `R$ ${item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'
                        }
                      </td>
                      {isFinalized && (
                        <td className="px-6 py-4 whitespace-nowrap">
                          <Badge variant="success">Adicionado ao Estoque</Badge>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
                <tfoot className="bg-gray-50">
                  <tr>
                    <td colSpan={isFinalized ? 5 : 4} className="px-6 py-3 text-right text-sm font-medium text-gray-900">
                      Total Geral:
                    </td>
                    <td className="px-6 py-3 text-sm font-medium text-gray-900">
                      {totalValue > 0 
                        ? `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : purchase.total_value 
                          ? `R$ ${purchase.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : 'Não definido'
                      }
                    </td>
                    {isFinalized && <td></td>}
                  </tr>
                </tfoot>
              </table>
            </div>

            {/* Mobile cards */}
            <div className="md:hidden space-y-4">
              {purchaseItems.map((item) => (
                <div key={item.id} className="border border-gray-200 rounded-lg p-4 space-y-3">
                  <div>
                    <div className="font-medium text-gray-900">{item.item.name}</div>
                    <div className="text-sm text-gray-500">{item.item.code}</div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="font-medium text-gray-500">Quantidade:</span>
                      <div className="text-gray-900">{item.quantity} {item.item.unit_measure}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Fornecedor:</span>
                      <div className="text-gray-900">{item.supplier?.name || '-'}</div>
                    </div>
                    <div>
                      <span className="font-medium text-gray-500">Preço Unit.:</span>
                      <div className="text-gray-900">
                        {item.unit_price 
                          ? `R$ ${item.unit_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'
                        }
                      </div>
                    </div>
                  </div>
                  
                  <div className="pt-2 border-t border-gray-100">
                    <div className="flex justify-between items-center">
                      <span className="font-medium text-gray-500">Total:</span>
                      <span className="font-medium text-gray-900">
                        {item.total_price 
                          ? `R$ ${item.total_price.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                          : '-'
                        }
                      </span>
                    </div>
                    {isFinalized && (
                      <div className="mt-2">
                        <Badge variant="success">Adicionado ao Estoque</Badge>
                      </div>
                    )}
                  </div>
                </div>
              ))}
              
              {/* Total geral mobile */}
              <div className={`rounded-lg p-4 ${isFinalized ? 'bg-green-50' : 'bg-gray-50'}`}>
                <div className="flex justify-between items-center">
                  <span className="text-lg font-medium text-gray-900">Total Geral:</span>
                  <span className={`text-lg font-bold ${isFinalized ? 'text-green-600' : 'text-primary-600'}`}>
                    {totalValue > 0 
                      ? `R$ ${totalValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                      : purchase.total_value 
                        ? `R$ ${purchase.total_value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
                        : 'Não definido'
                    }
                  </span>
                </div>
                {isFinalized && (
                  <p className="text-sm text-green-600 mt-1">
                    ✅ Valor debitado do orçamento da unidade
                  </p>
                )}
              </div>
            </div>
          </>
        )}
      </Card>

      {/* Informações de Rastreamento */}
      {isFinalized && (
        <Card>
          <h3 className="text-lg font-medium text-gray-900 mb-4">Rastreamento Automático</h3>
          <div className="space-y-3">
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  ✅ Itens adicionados automaticamente ao estoque da unidade <strong>{purchase.unit?.name}</strong>
                </p>
                <span className="text-xs text-gray-400">Processado automaticamente</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  💰 Valor debitado do orçamento da unidade
                </p>
                <span className="text-xs text-gray-400">Transação financeira criada</span>
              </div>
            </div>
            <div className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-2 h-2 bg-green-400 rounded-full mt-2"></div>
              <div className="min-w-0 flex-1">
                <p className="text-sm text-gray-600">
                  📋 Movimentações de estoque registradas automaticamente
                </p>
                <span className="text-xs text-gray-400">Logs de auditoria criados</span>
              </div>
            </div>
          </div>
        </Card>
      )}
    </div>
  );
};

export default PurchaseDetails;