import React, { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';
import ItemForm from './ItemForm';
import toast from 'react-hot-toast';

const Items: React.FC = () => {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Item | null>(null);
  const permissions = usePermissions();

  useEffect(() => {
    fetchItems();
  }, []);

  const fetchItems = async () => {
    try {
      const { data, error } = await supabase
        .from('items')
        .select('*')
        .order('name');

      if (error) throw error;
      setItems(data || []);
    } catch (error) {
      console.error('Error fetching items:', error);
      toast.error('Erro ao carregar itens');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canDelete) {
      toast.error('Você não tem permissão para excluir itens');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este item?')) {
      try {
        const { error } = await supabase
          .from('items')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setItems(items.filter(item => item.id !== id));
        toast.success('Item excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting item:', error);
        toast.error('Erro ao excluir item');
      }
    }
  };

  const handleItemSaved = (savedItem: Item) => {
    if (editingItem) {
      setItems(items.map(item => item.id === savedItem.id ? savedItem : item));
    } else {
      setItems([...items, savedItem]);
    }
    setModalOpen(false);
    setEditingItem(null);
  };

  // Verificar se o usuário tem acesso ao módulo de itens
  if (!permissions.canAccessItems) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar o módulo de itens.</p>
        </div>
      </div>
    );
  }

  const columns = [
    {
      key: 'code',
      title: 'Código',
    },
    {
      key: 'name',
      title: 'Nome',
    },
    {
      key: 'description',
      title: 'Descrição',
      render: (value: string) => value || '-'
    },
    {
      key: 'unit_measure',
      title: 'Unidade',
    },
    {
      key: 'category',
      title: 'Categoria',
      render: (value: string) => value || '-'
    },
    {
      key: 'show_in_company',
      title: 'Exibir na Empresa',
      render: (value: boolean) => (
        <Badge variant={value ? 'success' : 'default'}>
          {value ? 'Sim' : 'Não'}
        </Badge>
      )
    },
    {
      key: 'has_lifecycle',
      title: 'Tem Vida Útil',
      render: (value: boolean) => (
        <Badge variant={value ? 'info' : 'default'}>
          {value ? 'Sim' : 'Não'}
        </Badge>
      )
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: Item) => (
        <div className="flex space-x-2">
          {permissions.canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingItem(record);
                setModalOpen(true);
              }}
            >
              Editar
            </Button>
          )}
          {permissions.canDelete && (
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
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Itens</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie o catálogo de itens do sistema
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => {
              setEditingItem(null);
              setModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Item
          </Button>
        )}
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={items}
          loading={loading}
          emptyMessage="Nenhum item cadastrado"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingItem(null);
        }}
        title={editingItem ? 'Editar Item' : 'Novo Item'}
        size="lg"
      >
        <ItemForm
          item={editingItem}
          onSave={handleItemSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingItem(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Items;