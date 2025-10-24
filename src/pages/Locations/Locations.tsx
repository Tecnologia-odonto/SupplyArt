import React, { useEffect, useState } from 'react';
import { formatDBDateForDisplay } from '../../utils/dateHelper';
import { PlusIcon, MapPinIcon, FunnelIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
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
  } | null;
}

const Locations: React.FC = () => {
  const [locations, setLocations] = useState<Location[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingLocation, setEditingLocation] = useState<Location | null>(null);
  const [filters, setFilters] = useState({
    name: '',
    description: '',
    unit_id: ''
  });
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchUnits();
    fetchLocations();
  }, []);

  useEffect(() => {
    fetchLocations();
  }, [filters]);

  const fetchUnits = async () => {
    try {
      const { data, error } = await supabase
        .from('units')
        .select('id, name')
        .order('name');

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
    }
  };

  const fetchLocations = async () => {
    try {
      let query = supabase
        .from('locations')
        .select(`
          id,
          name,
          description,
          unit_id,
          created_at,
          unit:units(name)
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
      
      let filteredData = data || [];
      
      // Aplicar filtros no frontend
      if (filters.name) {
        filteredData = filteredData.filter(location => 
          location.name.toLowerCase().includes(filters.name.toLowerCase())
        );
      }
      
      if (filters.description) {
        filteredData = filteredData.filter(location => 
          location.description?.toLowerCase().includes(filters.description.toLowerCase())
        );
      }
      
      if (filters.unit_id) {
        filteredData = filteredData.filter(location => 
          location.unit_id === filters.unit_id
        );
      }
      
      setLocations(filteredData);
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
      render: (unit: any) => (
        <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
          {unit?.name || 'Unidade não encontrada'}
        </span>
      )
    },
    {
      key: 'created_at',
      title: 'Criado em',
      render: (value: string) => formatDBDateForDisplay(value)
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

      {/* Filtros */}
      <Card>
        <div className="flex items-center mb-4">
          <FunnelIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label htmlFor="filter_name" className="block text-sm font-medium text-gray-700 mb-1">
              Nome
            </label>
            <input
              id="filter_name"
              type="text"
              value={filters.name}
              onChange={(e) => setFilters(prev => ({ ...prev, name: e.target.value }))}
              placeholder="Filtrar por nome..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="filter_description" className="block text-sm font-medium text-gray-700 mb-1">
              Descrição
            </label>
            <input
              id="filter_description"
              type="text"
              value={filters.description}
              onChange={(e) => setFilters(prev => ({ ...prev, description: e.target.value }))}
              placeholder="Filtrar por descrição..."
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="filter_unit" className="block text-sm font-medium text-gray-700 mb-1">
              Unidade
            </label>
            <select
              id="filter_unit"
              value={filters.unit_id}
              onChange={(e) => setFilters(prev => ({ ...prev, unit_id: e.target.value }))}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            >
              <option value="">Todas as unidades</option>
              {units.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {unit.name}
                </option>
              ))}
            </select>
          </div>
          
          <div className="flex items-end">
            <Button
              variant="outline"
              onClick={() => setFilters({ name: '', description: '', unit_id: '' })}
              className="w-full"
            >
              Limpar Filtros
            </Button>
          </div>
        </div>
      </Card>

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