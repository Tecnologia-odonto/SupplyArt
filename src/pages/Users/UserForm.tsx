import React, { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Profile, Unit } from '../../types/database';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface UserFormProps {
  user?: Profile | null;
  onSave: () => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  email: string;
  role: 'admin' | 'gestor' | 'operador-financeiro' | 'operador-administrativo' | 'operador-almoxarife';
  unit_id: string;
  password?: string;
}

const UserForm: React.FC<UserFormProps> = ({ user, onSave, onCancel }) => {
  const [units, setUnits] = useState<Unit[]>([]);
  const [loading, setLoading] = useState(true);

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: user?.name || '',
      email: user?.email || '',
      role: user?.role || 'operador-administrativo',
      unit_id: user?.unit_id || '',
      password: '',
    }
  });

  const selectedRole = watch('role');

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

  const onSubmit = async (data: FormData) => {
    try {
      if (!user) {
        // Tentar criar novo usuário usando edge function
        let edgeFunctionFailed = false;
        
        try {
          const { data: response, error } = await supabase.functions.invoke('create-user', {
            body: {
              email: data.email,
              password: data.password || 'temp123456',
              name: data.name,
              role: data.role,
              unit_id: data.unit_id || null,
            }
          });

          if (error) {
            edgeFunctionFailed = true;
          }
        } catch (fetchError) {
          // Captura erros de rede ou outros erros de fetch
          edgeFunctionFailed = true;
        }

        if (edgeFunctionFailed) {
          // Método alternativo: usar signUp mas fazer logout imediatamente
          const currentSession = await supabase.auth.getSession();
          
          const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
            email: data.email,
            password: data.password || 'temp123456',
          });

          if (signUpError) throw signUpError;

          if (signUpData.user) {
            // Aguardar um pouco para garantir que o trigger criou o perfil
            await new Promise(resolve => setTimeout(resolve, 1000));
            
            // Atualizar o perfil criado automaticamente pelo trigger
            const { error: profileError } = await supabase
              .from('profiles')
              .update({
                name: data.name,
                email: data.email,
                role: data.role,
                unit_id: data.unit_id || null,
              })
              .eq('id', signUpData.user.id);

            if (profileError) throw profileError;

            // Fazer logout do usuário recém-criado e restaurar sessão anterior
            await supabase.auth.signOut();
            
            // Se havia uma sessão anterior, tentar restaurá-la
            if (currentSession.data.session) {
              await supabase.auth.setSession(currentSession.data.session);
            }
          }
        }
      } else {
        // Atualizar usuário existente
        const { error } = await supabase
          .from('profiles')
          .update({
            name: data.name,
            email: data.email,
            role: data.role,
            unit_id: data.unit_id || null,
          })
          .eq('id', user.id);

        if (error) throw error;
      }

      onSave();
      toast.success(user ? 'Usuário atualizado com sucesso!' : 'Usuário criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving user:', error);
      toast.error(error.message || 'Erro ao salvar usuário');
    }
  };

  if (loading) {
    return <div className="p-4">Carregando...</div>;
  }

  const roleOptions = [
    { value: 'admin', label: 'Administrador' },
    { value: 'gestor', label: 'Gestor' },
    { value: 'operador-financeiro', label: 'Operador Financeiro' },
    { value: 'operador-administrativo', label: 'Operador Administrativo' },
    { value: 'operador-almoxarife', label: 'Operador Almoxarife' },
  ];

  const needsUnit = ['operador-administrativo'].includes(selectedRole);

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div>
        <label htmlFor="name" className="block text-sm font-medium text-gray-700">
          Nome Completo *
        </label>
        <input
          id="name"
          type="text"
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
        <label htmlFor="email" className="block text-sm font-medium text-gray-700">
          Email *
        </label>
        <input
          id="email"
          type="email"
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
            errors.email ? 'border-error-300' : ''
          }`}
          {...register('email', { 
            required: 'Email é obrigatório',
            pattern: {
              value: /^\S+@\S+$/i,
              message: 'Email inválido'
            }
          })}
        />
        {errors.email && (
          <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
        )}
      </div>

      {!user && (
        <div>
          <label htmlFor="password" className="block text-sm font-medium text-gray-700">
            Senha Temporária
          </label>
          <input
            id="password"
            type="password"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            placeholder="Deixe em branco para usar senha padrão"
            {...register('password')}
          />
          <p className="mt-1 text-xs text-gray-500">
            Se não informar uma senha, será usada a senha padrão: temp123456
          </p>
        </div>
      )}

      <div>
        <label htmlFor="role" className="block text-sm font-medium text-gray-700">
          Função *
        </label>
        <select
          id="role"
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
            errors.role ? 'border-error-300' : ''
          }`}
          {...register('role', { required: 'Função é obrigatória' })}
        >
          {roleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        {errors.role && (
          <p className="mt-1 text-sm text-error-600">{errors.role.message}</p>
        )}
      </div>

      <div>
        <label htmlFor="unit_id" className="block text-sm font-medium text-gray-700">
          Unidade {needsUnit ? '*' : '(Opcional)'}
        </label>
        <select
          id="unit_id"
          className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
            errors.unit_id ? 'border-error-300' : ''
          }`}
          {...register('unit_id', { 
            required: needsUnit ? 'Unidade é obrigatória para esta função' : false 
          })}
        >
          <option value="">
            {needsUnit ? 'Selecione uma unidade' : 'Todas as unidades'}
          </option>
          {units.map((unit) => (
            <option key={unit.id} value={unit.id}>
              {unit.name}
            </option>
          ))}
        </select>
        {errors.unit_id && (
          <p className="mt-1 text-sm text-error-600">{errors.unit_id.message}</p>
        )}
        {needsUnit && (
          <p className="mt-1 text-xs text-gray-500">
            Operadores administrativos devem estar vinculados a uma unidade específica.
          </p>
        )}
      </div>

      <div className="flex justify-end space-x-3 pt-4">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancelar
        </Button>
        <Button type="submit" loading={isSubmitting}>
          {user ? 'Atualizar' : 'Criar'} Usuário
        </Button>
      </div>
    </form>
  );
};

export default UserForm;