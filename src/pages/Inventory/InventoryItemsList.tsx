import React, { useEffect, useState } from 'react';
import { formatDBDateForDisplay } from '../../utils/dateHelper';
import { PlusIcon, ClockIcon, WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import InventoryItemForm from './InventoryItemForm';
import toast from 'react-hot-toast';

interface InventoryItemsListProps {
  inventoryId: string;
  itemName: string;
  hasLifecycle: boolean;
}

interface InventoryEvent {
  id: string;
  event_type: 'maintenance' | 'repair' | 'inspection' | 'relocation' | 'status_change' | 'other';
  description: string;
  performed_by: string | null;
  cost: number | null;
  notes: string | null;
  event_date: string;
  next_action_date: string | null;
  created_at: string;
}

const InventoryItemsList: React.FC<InventoryItemsListProps> = ({ 
  inventoryId, 
  itemName, 
  hasLifecycle 
}) => {
  const [inventoryEvents, setInventoryEvents] = useState<InventoryEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<any>(null);
  const { profile } = useAuth();

  useEffect(() => {
    if (hasLifecycle) {
      fetchInventoryEvents();
    }
  }, [inventoryId, hasLifecycle]);

  const fetchInventoryEvents = async () => {
    try {
      const { data, error } = await supabase
        .from('inventory_events')
        .select('*')
        .eq('inventory_id', inventoryId)
        .order('event_date', { ascending: false });

      if (error) throw error;
      setInventoryEvents(data || []);
    } catch (error) {
      console.error('Error fetching inventory events:', error);
      toast.error('Erro ao carregar histórico do item');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!profile || !['admin', 'gestor'].includes(profile.role)) {
      toast.error('Você não tem permissão para excluir eventos');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este evento?')) {
      try {
        const { error } = await supabase
          .from('inventory_events')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setInventoryEvents(inventoryEvents.filter(event => event.id !== id));
        toast.success('Evento excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting inventory event:', error);
        toast.error('Erro ao excluir evento');
      }
    }
  };

  const handleEventSaved = () => {
    fetchInventoryEvents();
    setModalOpen(false);
    setEditingEvent(null);
  };

  const getEventTypeBadge = (type: string) => {
    const typeMap = {
      maintenance: { variant: 'info' as const, label: 'Manutenção' },
      repair: { variant: 'warning' as const, label: 'Reparo' },
      inspection: { variant: 'success' as const, label: 'Inspeção' },
      relocation: { variant: 'default' as const, label: 'Relocação' },
      status_change: { variant: 'error' as const, label: 'Mudança Status' },
      other: { variant: 'default' as const, label: 'Outro' },
    };

    const typeInfo = typeMap[type as keyof typeof typeMap] || { variant: 'default' as const, label: type };
    return <Badge variant={typeInfo.variant}>{typeInfo.label}</Badge>;
  };

  const getNextActionStatus = (nextActionDate: string | null) => {
    if (!nextActionDate) return null;
    
    const today = new Date();
    const actionDate = new Date(nextActionDate);
    const diffDays = Math.ceil((actionDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      return <Badge variant="error">Ação Atrasada</Badge>;
    } else if (diffDays <= 7) {
      return <Badge variant="warning">Ação Próxima</Badge>;
    } else if (diffDays <= 30) {
      return <Badge variant="info">Ação em Breve</Badge>;
    }
    
    return null;
  };

  if (!hasLifecycle) {
    return (
      <div className="text-center py-8 text-gray-500">
        <WrenchScrewdriverIcon className="mx-auto h-12 w-12 text-gray-400" />
        <h3 className="mt-2 text-sm font-medium text-gray-900">Sem Controle de Vida Útil</h3>
        <p className="mt-1 text-sm text-gray-500">
          Este item não possui controle individual de vida útil.
        </p>
      </div>
    );
  }

  const canEdit = profile?.role && ['admin', 'gestor', 'operador-almoxarife', 'operador-administrativo'].includes(profile.role);
  const canDelete = profile?.role && ['admin', 'gestor'].includes(profile.role);

  const columns = [
    {
      key: 'event_date',
      title: 'Data',
      render: (value: string) => formatDBDateForDisplay(value)
    },
    {
      key: 'event_type',
      title: 'Tipo',
      render: (value: string) => getEventTypeBadge(value)
    },
    {
      key: 'description',
      title: 'Descrição',
      render: (value: string) => (
        <span className="text-sm" title={value}>
          {value.length > 50 ? `${value.substring(0, 50)}...` : value}
        </span>
      )
    },
    {
      key: 'performed_by',
      title: 'Executado por',
      render: (value: string) => value || '-'
    },
    {
      key: 'cost',
      title: 'Custo',
      render: (value: number) => value ? `R$ ${value.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}` : '-'
    },
    {
      key: 'next_action_date',
      title: 'Próxima Ação',
      render: (value: string, record: InventoryEvent) => (
        <div className="space-y-1">
          {value ? (
            <div className="text-sm">
              {formatDBDateForDisplay(value)}
            </div>
          ) : (
            <span className="text-gray-500">-</span>
          )}
          {getNextActionStatus(value)}
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: InventoryEvent) => (
        <div className="flex space-x-1 sm:space-x-2">
          {canEdit && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingEvent(record);
                setModalOpen(true);
              }}
            >
              Editar
            </Button>
          )}
          {canDelete && (
            <Button
              size="sm"
              variant="danger"
              onClick={() => handleDelete(record.id)}
            >
              Excluir
            </Button>
          )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-lg font-medium text-gray-900">
            Histórico de Vida - {itemName}
          </h3>
          <p className="text-sm text-gray-500">
            Registros de manutenções, reparos e eventos deste item
          </p>
        </div>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditingEvent(null);
              setModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Registrar Evento
          </Button>
        )}
      </div>

      {/* Resumo de próximas ações */}
      {inventoryEvents.some(e => e.next_action_date) && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
          <div className="flex items-center">
            <ClockIcon className="h-5 w-5 text-yellow-600 mr-2" />
            <h4 className="text-sm font-medium text-yellow-800">Próximas Ações Programadas</h4>
          </div>
          <div className="mt-2 space-y-1">
            {inventoryEvents
              .filter(e => e.next_action_date)
              .slice(0, 3)
              .map(event => (
                <div key={event.id} className="text-xs text-yellow-700">
                  {formatDBDateForDisplay(event.next_action_date!)} - {event.description}
                </div>
              ))}
          </div>
        </div>
      )}

      <Table
        columns={columns}
        data={inventoryEvents}
        loading={loading}
        emptyMessage="Nenhum evento registrado para este item"
      />

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingEvent(null);
        }}
        title={editingEvent ? 'Editar Evento' : 'Registrar Novo Evento'}
        size="lg"
      >
        <InventoryItemForm
          inventoryItem={editingEvent}
          inventoryId={inventoryId}
          itemName={itemName}
          onSave={handleEventSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingEvent(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default InventoryItemsList;