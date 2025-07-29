import React, { useEffect, useState } from 'react';
import { PlusIcon, MapPinIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import LocationForm from './LocationForm';
import toast from 'react-hot-toast';

interface Location {
  id: string;
  name: string;
  description: string | null;
  unit_id: string;
  created_at: string;
  unit: {
    name: string;
  };
}

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchLocations();
  }, []);

  const fetchLocations = async () => {
    try {
      let query = supabase
        .from('locations')
        .select(`
          id,
          name,
          description,
          unit_id,
          created_at
        `)
        .order('name');

      // Filter based on user role
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        query = query.eq('unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        query = query.eq('unit_id', profile.unit_id);
      }
      // Admin and almoxarife can see all locations

      const { data, error } = await query;

      if (error) throw error;

      // Fetch unit names separately to avoid join issues
      if (data && data.length > 0) {
        const unitIds = [...new Set(data.map(loc => loc.unit_id))];
        const { data: unitsData } = await supabase
          .from('units')
          .select('id, name')
          .in('id', unitIds);

        const unitsMap = new Map(unitsData?.map(unit => [unit.id, unit]) || []);
        
        const locationsWithUnits = data.map(location => ({
          ...location,
          unit: unitsMap.get(location.unit_id) || { name: 'Unidade não encontrada' }
        }));

        setLocations(locationsWithUnits);
      } else {
        setLocations([]);
      }
    } catch (error) {
      console.error('Error fetching locations:', error);
      toast.error('Erro ao carregar localizações');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canDelete) {
      toast.error('Você não tem permissão para excluir localizações');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir esta localização?')) {
      try {
        const { error } = await supabase
          .from('locations')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setLocations(locations.filter(location => location.id !== id));
        toast.success('Localização excluída com sucesso!');
      } catch (error) {
        console.error('Error deleting location:', error);
        toast.error('Erro ao excluir localização');
      }
    }
  };

  const handleLocationSaved = (savedLocation: Location) => {
    if (editingLocation) {
      setLocations(locations.map(location => 
        location.id === savedLocation.id ? savedLocation : location
      ));
    } else {
      setLocations([...locations, savedLocation]);
    }
    setModalOpen(false);
    setEditingLocation(null);
  };

  const columns = [
    {
      key: 'name',
      title: 'Nome',
      render: (value: string) => (
        <div className="flex items-center">
          <MapPinIcon className="h-5 w-5 text-gray-400 mr-3" />
          <span className="font-medium">{value}</span>
        </div>
      )
    },
    {
      key: 'description',
      title: 'Descrição',
      render: (value: string) => value || '-'
    },
    {
      key: 'unit',
      title: 'Unidade',
      render: (unit: any) => unit?.name || '-'
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: Location) => (
        <div className="flex space-x-2">
          {permissions.canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingLocation(record);
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
          <h1 className="text-2xl font-semibold text-gray-900">Localizações</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie departamentos e localizações para organização do estoque
            {profile?.role === 'operador-administrativo' && ' - Sua unidade'}
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => {
              setEditingLocation(null);
              setModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Nova Localização
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <MapPinIcon className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Localizações</p>
              <p className="text-lg font-semibold text-gray-900">{locations.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={locations}
          loading={loading}
          emptyMessage="Nenhuma localização cadastrada"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingLocation(null);
        }}
        title={editingLocation ? 'Editar Localização' : 'Nova Localização'}
        size="lg"
      >
        <LocationForm
          location={editingLocation}
          onSave={handleLocationSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingLocation(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Locations;