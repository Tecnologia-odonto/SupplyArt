import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { UserIcon, EnvelopeIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import toast from 'react-hot-toast';

interface ProfileFormData {
  name: string;
  email: string;
  sector: string;
}

const Profile: React.FC = () => {
  const { profile, user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [emailConfirmationSent, setEmailConfirmationSent] = useState(false);

  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<ProfileFormData>({
    defaultValues: {
      name: profile?.name || '',
      email: profile?.email || '',
      sector: '', // Novo campo para setor
    }
  });

  const onSubmit = async (data: ProfileFormData) => {
    if (!profile) return;

    try {
      setLoading(true);

      // Atualizar perfil
      const { error: profileError } = await supabase
        .from('profiles')
        .update({
          name: data.name,
          // Note: email não é atualizado aqui pois requer confirmação
        })
        .eq('id', profile.id);

      if (profileError) throw profileError;

      // Se o email foi alterado, enviar confirmação
      if (data.email !== profile.email) {
        const { error: emailError } = await supabase.auth.updateUser({
          email: data.email
        });

        if (emailError) throw emailError;
        
        setEmailConfirmationSent(true);
        toast.success('Perfil atualizado! Verifique seu email para confirmar a alteração.');
      } else {
        toast.success('Perfil atualizado com sucesso!');
      }

      // Recarregar a página para atualizar os dados
      window.location.reload();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      toast.error(error.message || 'Erro ao atualizar perfil');
    } finally {
      setLoading(false);
    }
  };

  const getRoleDisplayName = (role: string) => {
    const roleMap = {
      'admin': 'Administrador',
      'gestor': 'Gestor',
      'operador-financeiro': 'Operador Financeiro',
      'operador-administrativo': 'Operador Administrativo',
      'operador-almoxarife': 'Operador Almoxarife',
    };
    return roleMap[role as keyof typeof roleMap] || role;
  };

  if (!profile) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-gray-900">Meu Perfil</h1>
        <p className="mt-1 text-sm text-gray-600">
          Visualize e edite suas informações pessoais
        </p>
      </div>

      {/* Informações Básicas */}
      <Card>
        <div className="flex items-center mb-6">
          <div className="h-16 w-16 rounded-full bg-primary-100 flex items-center justify-center">
            <UserIcon className="h-8 w-8 text-primary-600" />
          </div>
          <div className="ml-4">
            <h2 className="text-xl font-medium text-gray-900">{profile.name}</h2>
            <p className="text-sm text-gray-500">{getRoleDisplayName(profile.role)}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nome Completo *
            </label>
            <div className="mt-1 relative">
              <input
                id="name"
                type="text"
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                  errors.name ? 'border-error-300' : ''
                }`}
                {...register('name', { required: 'Nome é obrigatório' })}
              />
              <UserIcon className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
            </div>
            {errors.name && (
              <p className="mt-1 text-sm text-error-600">{errors.name.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email *
            </label>
            <div className="mt-1 relative">
              <input
                id="email"
                type="email"
                className={`block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
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
              <EnvelopeIcon className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
            </div>
            {errors.email && (
              <p className="mt-1 text-sm text-error-600">{errors.email.message}</p>
            )}
            {emailConfirmationSent && (
              <p className="mt-1 text-sm text-blue-600">
                Email de confirmação enviado. Verifique sua caixa de entrada.
              </p>
            )}
          </div>

          <div>
            <label htmlFor="sector" className="block text-sm font-medium text-gray-700">
              Setor
            </label>
            <div className="mt-1 relative">
              <input
                id="sector"
                type="text"
                placeholder="Ex: Administrativo, Clínica, Recepção"
                className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
                {...register('sector')}
              />
              <BuildingOffice2Icon className="absolute right-3 top-2 h-5 w-5 text-gray-400" />
            </div>
          </div>

          <div className="pt-4">
            <Button type="submit" loading={isSubmitting || loading}>
              Salvar Alterações
            </Button>
          </div>
        </form>
      </Card>

      {/* Informações do Sistema */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Informações do Sistema</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-500">Função</label>
            <p className="mt-1 text-sm text-gray-900">{getRoleDisplayName(profile.role)}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Unidade Vinculada</label>
            <p className="mt-1 text-sm text-gray-900">
              {profile.unit_id ? 'Unidade específica' : 'Todas as unidades'}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Data de Cadastro</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(profile.created_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-500">Última Atualização</label>
            <p className="mt-1 text-sm text-gray-900">
              {new Date(profile.updated_at).toLocaleDateString('pt-BR')}
            </p>
          </div>
        </div>
      </Card>

      {/* Informações de Segurança */}
      <Card>
        <h3 className="text-lg font-medium text-gray-900 mb-4">Segurança</h3>
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-900">Alterar Senha</p>
              <p className="text-sm text-gray-500">Recomendamos alterar sua senha periodicamente</p>
            </div>
            <Button
              variant="outline"
              onClick={() => {
                // Enviar email de alteração de senha
                supabase.auth.resetPasswordForEmail(profile.email, {
                  redirectTo: `${window.location.origin}/reset-password`
                });
                toast.success('Email de alteração de senha enviado!');
              }}
            >
              Alterar Senha
            </Button>
          </div>
          
          {profile.role === 'operador-administrativo' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4">
              <div className="flex items-center">
                <div className="flex-shrink-0">
                  <span className="text-yellow-600 text-xl">⏰</span>
                </div>
                <div className="ml-3">
                  <h4 className="text-sm font-medium text-yellow-800">Logout Automático</h4>
                  <p className="text-sm text-yellow-700 mt-1">
                    Sua sessão será encerrada automaticamente após 2 horas de inatividade por motivos de segurança.
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </Card>
    </div>
  );
};

export default Profile;