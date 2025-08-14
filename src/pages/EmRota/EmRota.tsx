import React, { useEffect, useState } from 'react';
import { TruckIcon, EyeIcon, CheckIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface EmRotaWithDetails {
  id: string;
  quantity: number;
  status: 'em_transito' | 'entregue';
  sent_at: string;
  delivered_at: string | null;
  notes: string | null;
  item: {
    code: string;
    name: string;
    unit_measure: string;
  };
  from_cd_unit: {
    name: string;
  };
  to_unit: {
    name: string;
  };
  request: {
    id: string;
  } | null;
}

// Componente da animação de entrega
const DeliveryAnimation: React.FC<{ 
  fromUnit: string; 
  toUnit: string; 
  sentAt: string; 
  isDelivered: boolean;
  onAnimationComplete?: () => void;
}> = ({ fromUnit, toUnit, sentAt, isDelivered, onAnimationComplete }) => {
  const [progress, setProgress] = useState(0);
  const [timeRemaining, setTimeRemaining] = useState('');
  
  useEffect(() => {
    if (isDelivered) {
      setProgress(100);
      return;
    }

    const sentTime = new Date(sentAt).getTime();
    const deliveryDuration = 3 * 60 * 60 * 1000; // 3 horas em ms
    const expectedDelivery = sentTime + deliveryDuration;
    
    const updateProgress = () => {
      const now = Date.now();
      const elapsed = now - sentTime;
      const progressPercent = Math.min((elapsed / deliveryDuration) * 100, 100);
      
      setProgress(progressPercent);
      
      // Calcular tempo restante
      const remaining = Math.max(expectedDelivery - now, 0);
      const hours = Math.floor(remaining / (1000 * 60 * 60));
      const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
      
      if (remaining > 0) {
        setTimeRemaining(`${hours}h ${minutes}m restantes`);
      } else {
        setTimeRemaining('Entrega prevista');
        if (onAnimationComplete) {
          onAnimationComplete();
        }
      }
    };

    updateProgress();
    const interval = setInterval(updateProgress, 30000); // Atualizar a cada 30 segundos

    return () => clearInterval(interval);
  }, [sentAt, isDelivered, onAnimationComplete]);

  return (
    <div className="bg-gradient-to-r from-blue-50 to-green-50 border border-blue-200 rounded-lg p-4 mb-4">
      <div className="flex items-center justify-between mb-3">
        <h4 className="text-sm font-medium text-blue-800">🚚 Rastreamento de Entrega</h4>
        <span className="text-xs text-blue-600 font-medium">
          {isDelivered ? '✅ Entregue' : timeRemaining}
        </span>
      </div>
      
      {/* Rota visual */}
      <div className="relative">
        {/* Linha da rota */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
            <span className="text-xs font-medium text-blue-700">{fromUnit}</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-medium text-green-700">{toUnit}</span>
            <div className={`w-3 h-3 rounded-full ${isDelivered ? 'bg-green-500' : 'bg-gray-300'}`}></div>
          </div>
        </div>
        
        {/* Barra de progresso */}
        <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
          <div 
            className="h-full bg-gradient-to-r from-blue-500 to-green-500 rounded-full transition-all duration-1000 ease-out"
            style={{ width: `${progress}%` }}
          ></div>
        </div>
        
        {/* Motinha animada */}
        <div 
          className="absolute top-0 transform -translate-y-1 transition-all duration-1000 ease-out"
          style={{ left: `calc(${progress}% - 12px)` }}
        >
          <div className={`text-lg ${isDelivered ? '' : 'animate-bounce'}`}>
            🏍️
          </div>
        </div>
      </div>
      
      {/* Informações adicionais */}
      <div className="mt-3 flex justify-between items-center text-xs text-gray-600">
        <span>Enviado: {new Date(sentAt).toLocaleString('pt-BR')}</span>
        <span className="font-medium">
          {Math.round(progress)}% do trajeto
        </span>
      </div>
    </div>
  );
};

const EmRota: React.FC = () => {
  const [emRotaItems, setEmRotaItems] = useState<EmRotaWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [selectedItemForAnimation, setSelectedItemForAnimation] = useState<any>(null);
  const [showAnimation, setShowAnimation] = useState(false);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchEmRotaItems();
  }, []);

  const fetchEmRotaItems = async () => {
    try {
      let query = supabase
        .from('em_rota')
        .select(`
          *,
          item:items(code, name, unit_measure),
          from_cd_unit:units!em_rota_from_cd_unit_id_fkey(name),
          to_unit:units!em_rota_to_unit_id_fkey(name),
          request:requests(id)
        `)
        .order('sent_at', { ascending: false });

      // Filtrar baseado no role do usuário
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        // Op. Administrativo: apenas itens destinados à sua unidade
        query = query.eq('to_unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: apenas itens destinados à sua unidade
        query = query.eq('to_unit_id', profile.unit_id);
      } else if (profile?.role === 'operador-almoxarife' && profile.unit_id) {
        // Op. Almoxarife: apenas itens do seu CD
        query = query.eq('from_cd_unit_id', profile.unit_id);
      }
      // Admin e Op. Almoxarife podem ver todos

      const { data, error } = await query;

      if (error) throw error;
      setEmRotaItems(data || []);
    } catch (error) {
      console.error('Error fetching em rota items:', error);
      toast.error('Erro ao carregar itens em rota');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsDelivered = async (id: string, requestId: string | null) => {
    if (!profile || !['admin', 'operador-almoxarife', 'operador-administrativo', 'gestor'].includes(profile.role)) {
      toast.error('Você não tem permissão para marcar como entregue');
      return;
    }

    if (window.confirm('Confirmar que este item foi entregue na unidade?')) {
      try {
        // Buscar dados do item em rota antes de marcar como entregue
        const { data: emRotaItem, error: fetchError } = await supabase
          .from('em_rota')
          .select('*')
          .eq('id', id)
          .single();

        if (fetchError) throw fetchError;

        // Marcar como entregue na tabela em_rota
        const { error: emRotaError } = await supabase
          .from('em_rota')
          .update({
            status: 'entregue',
            delivered_at: new Date().toISOString()
          })
          .eq('id', id);

        if (emRotaError) throw emRotaError;

        // Adicionar ao estoque da unidade de destino
        const { data: existingStock, error: stockCheckError } = await supabase
          .from('stock')
          .select('*')
          .eq('item_id', emRotaItem.item_id)
          .eq('unit_id', emRotaItem.to_unit_id)
          .maybeSingle();

        if (stockCheckError && stockCheckError.code !== 'PGRST116') throw stockCheckError;

        if (existingStock) {
          // Atualizar estoque existente
          const { error: updateStockError } = await supabase
            .from('stock')
            .update({
              quantity: existingStock.quantity + emRotaItem.quantity
            })
            .eq('id', existingStock.id);

          if (updateStockError) throw updateStockError;
        } else {
          // Criar novo registro de estoque
          const { error: insertStockError } = await supabase
            .from('stock')
            .insert({
              item_id: emRotaItem.item_id,
              unit_id: emRotaItem.to_unit_id,
              quantity: emRotaItem.quantity,
              location: 'Estoque Geral'
            });

          if (insertStockError) throw insertStockError;
        }

        // Criar movimentação de entrega
        if (profile) {
          const { error: movementError } = await supabase
            .from('movements')
            .insert({
              item_id: emRotaItem.item_id,
              from_unit_id: emRotaItem.from_cd_unit_id,
              to_unit_id: emRotaItem.to_unit_id,
              quantity: emRotaItem.quantity,
              type: 'transfer',
              reference: `Entrega em rota - ID: ${id.slice(0, 8)}`,
              notes: `Item entregue na unidade via sistema em rota`,
              created_by: profile.id
            });

          if (movementError) throw movementError;
        }

        // Se houver request_id, verificar se todos os itens foram entregues
        if (requestId) {
          const { data: allEmRotaItems } = await supabase
            .from('em_rota')
            .select('status')
            .eq('request_id', requestId);
          
          if (allEmRotaItems) {
            const allDelivered = allEmRotaItems.every(item => item.status === 'entregue');
            
            if (allDelivered) {
              // Todos os itens foram entregues, marcar pedido como recebido
              const { error: requestError } = await supabase
                .from('requests')
                .update({ status: 'recebido' })
                .eq('id', requestId);

              if (requestError) throw requestError;
              
              toast.success('🎉 Todos os itens do pedido foram entregues! Pedido marcado como recebido.');
            }
          }
        }

        fetchEmRotaItems();
        toast.success('Item entregue com sucesso! Adicionado ao estoque da unidade.');
      } catch (error) {
        console.error('Error marking as delivered:', error);
        toast.error('Erro ao marcar como entregue');
      }
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'em_transito':
        return <Badge variant="warning">Em Trânsito</Badge>;
      case 'entregue':
        return <Badge variant="success">Entregue</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  const getVisibilityInfo = () => {
    if (!profile) return '';
    
    switch (profile.role) {
      case 'admin':
        return 'Visualizando: Todos os itens em rota do sistema';
      case 'operador-almoxarife':
        return 'Visualizando: Todos os itens em rota do sistema';
      case 'gestor':
      case 'operador-administrativo':
        return 'Visualizando: Apenas itens destinados à sua unidade';
      default:
        return '';
    }
  };

  const columns = [
    {
      key: 'item',
      title: 'Item',
      render: (item: any) => (
        <div>
          <div className="font-medium">{item.name}</div>
          <div className="text-sm text-gray-500">{item.code}</div>
        </div>
      )
    },
    {
      key: 'quantity',
      title: 'Quantidade',
      render: (value: number, record: EmRotaWithDetails) => (
        <div className="flex items-center space-x-2">
          <span className="font-medium">{value}</span>
          <span className="text-sm text-gray-500">{record.item.unit_measure}</span>
        </div>
      )
    },
    {
      key: 'from_cd_unit',
      title: 'De (CD)',
      render: (unit: any) => (
        <div className="flex items-center">
          <TruckIcon className="w-4 h-4 mr-1 text-blue-600" />
          {unit.name}
        </div>
      )
    },
    {
      key: 'to_unit',
      title: 'Para (Unidade)',
      render: (unit: any) => unit.name
    },
    {
      key: 'status',
      title: 'Status',
      render: (value: string) => getStatusBadge(value)
    },
    {
      key: 'sent_at',
      title: 'Enviado em',
      render: (value: string) => (
        <div>
          <div className="text-sm">{new Date(value).toLocaleDateString('pt-BR')}</div>
          <div className="text-xs text-gray-500">{new Date(value).toLocaleTimeString('pt-BR')}</div>
        </div>
      )
    },
    {
      key: 'delivered_at',
      title: 'Entregue em',
      render: (value: string | null) => value ? (
        <div>
          <div className="text-sm">{new Date(value).toLocaleDateString('pt-BR')}</div>
          <div className="text-xs text-gray-500">{new Date(value).toLocaleTimeString('pt-BR')}</div>
        </div>
      ) : '-'
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: EmRotaWithDetails) => (
        <div className="flex space-x-1 sm:space-x-2">
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedItemForAnimation(record);
              setShowAnimation(true);
            }}
            title="Ver animação de entrega"
          >
            <MapPinIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => {
              setSelectedItem(record);
              setDetailsModalOpen(true);
            }}
          >
            <EyeIcon className="w-3 h-3 sm:w-4 sm:h-4" />
          </Button>
          {record.status === 'em_transito' && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => handleMarkAsDelivered(record.id, record.request?.id || null)}
              className="text-green-600 hover:text-green-700"
            >
              <CheckIcon className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          )}
        </div>
      ),
    },
  ];

  if (!permissions.canRead) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar itens em rota.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900">Itens Em Rota</h1>
          <p className="mt-1 text-sm text-gray-600">
            Controle de itens em trânsito entre CDs e unidades
          </p>
          {getVisibilityInfo() && (
            <p className="mt-1 text-xs text-blue-600 font-medium">
              {getVisibilityInfo()}
            </p>
          )}
        </div>
      </div>

      {/* Informação sobre o módulo */}
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <div className="flex items-start">
          <TruckIcon className="h-5 w-5 text-blue-600 mt-0.5 mr-3 flex-shrink-0" />
          <div className="flex-1">
            <h3 className="text-sm font-medium text-blue-800 mb-2">🚚 Fluxo de Distribuição</h3>
            <div className="text-xs text-blue-700 space-y-1">
              <p><strong>1. Enviado:</strong> Item sai do estoque do CD e entra "Em Rota"</p>
              <p><strong>2. Em Trânsito:</strong> Item está a caminho da unidade de destino</p>
              <p><strong>3. Entregue:</strong> Item sai de "Em Rota" e entra no estoque da unidade</p>
              <p><strong>Automático:</strong> Movimentações são registradas automaticamente</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
        {/* Animação de entrega para item selecionado */}
        {showAnimation && selectedItemForAnimation && (
          <div className="col-span-full">
            <DeliveryAnimation
              fromUnit={selectedItemForAnimation.from_cd_unit.name}
              toUnit={selectedItemForAnimation.to_unit.name}
              sentAt={selectedItemForAnimation.sent_at}
              isDelivered={selectedItemForAnimation.status === 'entregue'}
              onAnimationComplete={() => {
                if (selectedItemForAnimation.status === 'em_transito') {
                  toast.info('⏰ Tempo de entrega estimado atingido! Confirme o recebimento.');
                }
              }}
            />
          </div>
        )}

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <TruckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-warning-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Em Trânsito</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {emRotaItems.filter(item => item.status === 'em_transito').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-success-100 rounded-full flex items-center justify-center">
                <CheckIcon className="w-4 h-4 sm:w-5 sm:h-5 text-success-600" />
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Entregues</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">
                {emRotaItems.filter(item => item.status === 'entregue').length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-3 sm:p-6">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-6 h-6 sm:w-8 sm:h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <span className="text-primary-600 font-semibold text-xs sm:text-sm">#</span>
              </div>
            </div>
            <div className="ml-2 sm:ml-3 min-w-0 flex-1">
              <p className="text-xs sm:text-sm font-medium text-gray-500 truncate">Total</p>
              <p className="text-sm sm:text-lg font-semibold text-gray-900">{emRotaItems.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        {/* Controles da animação */}
        {showAnimation && (
          <div className="p-4 bg-blue-50 border-b border-blue-200">
            <div className="flex justify-between items-center">
              <h3 className="text-sm font-medium text-blue-800">
                🏍️ Rastreamento: {selectedItemForAnimation?.item.name}
              </h3>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setShowAnimation(false);
                  setSelectedItemForAnimation(null);
                }}
              >
                Fechar Rastreamento
              </Button>
            </div>
          </div>
        )}
        
        <Table
          columns={columns}
          data={emRotaItems}
          loading={loading}
          emptyMessage="Nenhum item em rota"
        />
      </Card>

      {/* Modal de Detalhes */}
      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedItem(null);
        }}
        title="Detalhes do Item Em Rota"
        size="lg"
      >
        {selectedItem && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Item</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedItem.item.name} ({selectedItem.item.code})
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Quantidade</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedItem.quantity} {selectedItem.item.unit_measure}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">De (CD)</label>
                <p className="mt-1 text-sm text-gray-900">{selectedItem.from_cd_unit.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Para (Unidade)</label>
                <p className="mt-1 text-sm text-gray-900">{selectedItem.to_unit.name}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Status</label>
                <div className="mt-1">{getStatusBadge(selectedItem.status)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Enviado em</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(selectedItem.sent_at).toLocaleString('pt-BR')}
                </p>
              </div>
              {selectedItem.delivered_at && (
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-500">Entregue em</label>
                  <p className="mt-1 text-sm text-gray-900">
                    {new Date(selectedItem.delivered_at).toLocaleString('pt-BR')}
                  </p>
                </div>
              )}
            </div>

            {selectedItem.notes && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Observações</label>
                <p className="mt-1 text-sm text-gray-900">{selectedItem.notes}</p>
              </div>
            )}

            {selectedItem.request && (
              <div>
                <label className="block text-sm font-medium text-gray-500">Pedido Relacionado</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">
                  #{selectedItem.request.id.slice(0, 8)}
                </p>
              </div>
            )}

            {selectedItem.status === 'em_transito' && (
              <div className="pt-4 border-t border-gray-200">
                <Button
                  onClick={() => {
                    handleMarkAsDelivered(selectedItem.id, selectedItem.request?.id || null);
                    setDetailsModalOpen(false);
                    setSelectedItem(null);
                  }}
                  className="w-full"
                >
                  <CheckIcon className="w-4 h-4 mr-2" />
                  Marcar como Entregue
                </Button>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default EmRota;