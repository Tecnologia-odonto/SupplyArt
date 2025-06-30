import React, { useEffect, useState } from 'react';
import { PlusIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';
import UnitForm from './UnitForm';
import toast from 'react-hot-toast';

const Units: React.FC = () => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUnit, setEditingUnit] = useState<Unit | null>(null);
  const permissions = usePermissions();

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('*')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast.error('Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canDelete) {
      toast.error('Você não tem permissão para excluir unidades');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta unidade?')) {
      try {
        const { error } = await supabase
          .from('units')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setUnits(units.filter(unit => unit.id !== id));
        toast.success('Unidade excluída com sucesso!');
      } catch (error) {
        console.error('Error deleting unit:', error);
        toast.error('Erro ao excluir unidade');
      }
    }
  };

  const handleUnitSaved = (savedUnit: Unit) => {
    if (editingUnit) {
      setUnits(units.map(unit => unit.id === savedUnit.id ? savedUnit : unit));
    } else {
      setUnits([...units, savedUnit]);
    }
    setModalOpen(false);
    setEditingUnit(null);
  };

  const columns = [
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
      key: 'address',
      title: 'Endereço',
      render: (value: string) => value || '-'
    },
    {
      key: 'is_cd',
      title: 'Tipo',
      render: (value: boolean) => (
        <Badge variant={value ? 'info' : 'default'}>
          {value ? 'Centro de Distribuição' : 'Filial'}
        </Badge>
      )
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: Unit) => (
        <div className="flex space-x-2">
          {permissions.canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingUnit(record);
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
          <h1 className="text-2xl font-semibold text-gray-900">Unidades</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie as unidades e centros de distribuição
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => {
              setEditingUnit(null);
              setModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Nova Unidade
          </Button>
        )}
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={units}
          loading={loading}
          emptyMessage="Nenhuma unidade cadastrada"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUnit(null);
        }}
        title={editingUnit ? 'Editar Unidade' : 'Nova Unidade'}
        size="lg"
      >
        <UnitForm
          unit={editingUnit}
          onSave={handleUnitSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingUnit(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Units;