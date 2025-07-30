import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Unit } from '../../types/database';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface LocationFormProps {
  location?: any;
  onSave: (location: any) => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  description: string;
  unit_id: string;
}

const LocationForm: React.FC<LocationFormProps> = ({ location, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);
  const { profile } = useAuth();

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: location?.name || '',
      description: location?.description || '',
      unit_id: location?.unit_id || profile?.unit_id || '',
    }
  });

  useEffect(() => {
    fetchUnits();
  }, []);

  const fetchUnits = async () => {
    try {
      let query = supabase.from('units').select('*').order('name');

      // Se for operador administrativo, mostrar apenas sua unidade
      if (profile?.role === 'operador-administrativo' && profile.unit_id) {
        query = query.eq('id', profile.unit_id);
      }

      const { data, error } = await query;

      if (error) throw error;
      setUnits(data || []);
    } catch (error) {
      console.error('Error fetching units:', error);
      toast.error('Erro ao carregar unidades');
    } finally {
      setLoading(false);
    }
  };

  const onSubmit = async (data: FormData) => {
    try {
      // Verificar se já existe uma localização com o mesmo nome na mesma unidade
      const { data: existingLocations, error: checkError } = await supabase
        .from('locations')
        .select('id, name, unit_id')
        .eq('name', data.name)
        .eq('unit_id', data.unit_id);

      if (checkError) throw checkError;

      // Verificar conflitos (ignorar a própria localização se estiver editando)
      const hasConflict = existingLocations?.some(existingLocation => {
        if (location && existingLocation.id === location.id) {
          return false;
        }
        return true;
      });

      if (hasConflict) {
        toast.error('Já existe uma localização com este nome nesta unidade');
        return;
      }

      const locationData = {
        name: data.name,
        description: data.description || null,
        unit_id: data.unit_id,
      };

      let result;
      if (location) {
        result = await supabase
          .from('locations')
          .update(locationData)
          .eq('id', location.id)
          .select(`
            id,
            name,
            description,
            unit_id,
            created_at,
            unit:units(name)
          `)
          .single();
      } else {
        result = await supabase
          .from('locations')
          .insert(locationData)
          .select(`
            id,
            name,
            description,
            unit_id,
            created_at,
            unit:units(name)
          `)
          .single();
      }

      if (result.error) throw result.error;

      onSave(result.data);
      toast.success(location ? 'Localização atualizada com sucesso!' : 'Localização criada com sucesso!');
    } catch (error: any) {
      console.error('Error saving location:', error);
      toast.error(error.message || 'Erro ao salvar localização');
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

  return (
    <div className="space-y-4">
      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome da Localização *
          </label>
          <input
            id="name"
            type="text"
            placeholder="Ex: Consultório 1, Recepção, Almoxarifado"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.name ? 'border-error-300' : ''
            }`}
            {...register('name', { required: 'Nome é obrigatório' })}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-error-600">{errors.name.message}</p>
          )}
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            placeholder="Descrição detalhada da localização..."
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('description')}
          />
        </div>

        <div>
          <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700">
            Unidade *
          </label>
          <select
            id="unit_id"
            disabled={profile?.role === 'operador-administrativo'}
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.unit_id ? 'border-error-300' : ''
            } ${profile?.role === 'operador-administrativo' ? 'bg-gray-100' : ''}`}
            {...register('unit_id', { required: 'Unidade é obrigatória' })}
          >
            <option value="">Selecione uma unidade</option>
            {units.map((unit) => (
              <option key={unit.id} value={unit.id}>
                {unit.name} {unit.is_cd ? '(CD)' : ''}
              </option>
            ))}
          </select>
          {errors.unit_id && (
            <p className="mt-1 text-sm text-error-600">{errors.unit_id.message}</p>
          )}
          {profile?.role === 'operador-administrativo' && (
            <p className="mt-1 text-xs text-gray-500">
              Como operador administrativo, você só pode criar localizações para sua unidade
            </p>
          )}
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {location ? 'Atualizar' : 'Criar'} Localização
          </Button>
        </div>
      </form>
    </div>
  );
};

export default LocationForm;