import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useAuth } from '../../contexts/AuthContext';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';
import { supabase } from '../../lib/supabase';

interface LoginForm {
  email: string;
  password: string;
}

const Login: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuth();
  const { register, handleSubmit, formState: { errors } } = useForm<LoginForm>();

  const createAuditLog = async (action: string, details?: any) => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        await supabase.from('audit_logs').insert({
          user_id: user.id,
          action,
          table_name: 'auth',
          record_id: user.id,
          new_values: details || { action }
        });
      }
    } catch (error) {
      console.error('Error creating audit log:', error);
    }
  };

  const onSubmit = async (data: LoginForm) => {
    setLoading(true);
    try {
      await signIn(data.email, data.password);
      
      // Create audit log for successful login
      await createAuditLog('LOGIN', { 
        email: data.email,
        timestamp: new Date().toISOString(),
        ip_address: 'unknown' // In a real app, you'd get this from the request
      });
      
      toast.success('Login realizado com sucesso!');
    } catch (error: any) {
      console.error('Login error:', error);
      
      // Create audit log for failed login attempt
      try {
        await supabase.from('audit_logs').insert({
          user_id: '00000000-0000-0000-0000-000000000000', // Anonymous user for failed attempts
          action: 'LOGIN_FAILED',
          table_name: 'auth',
          record_id: null,
          new_values: { 
            email: data.email,
            error: error.message,
            timestamp: new Date().toISOString()
          }
        });
      } catch (logError) {
        console.error('Error logging failed login:', logError);
      }
      
      if (error.message?.includes('Invalid login credentials')) {
        toast.error('Email ou senha incorretos. Verifique suas credenciais.');
      } else {
        toast.error(error.message || 'Erro ao fazer login');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 flex items-center justify-center rounded-full bg-primary-600">
            <span className="text-lg sm:text-2xl font-bold text-white">SA</span>
          </div>
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            SupplyArt
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Sistema de Estoque e Inventário
          </p>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.email ? 'border-error-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base`}
                placeholder="seu@email.com"
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
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Senha
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                className={`mt-1 appearance-none relative block w-full px-3 py-2 border ${
                  errors.password ? 'border-error-300' : 'border-gray-300'
                } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base`}
                placeholder="Sua senha"
                {...register('password', {
                  required: 'Senha é obrigatória',
                  minLength: {
                    value: 6,
                    message: 'Senha deve ter pelo menos 6 caracteres'
                  }
                })}
              />
              {errors.password && (
                <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>
              )}
            </div>
          </div>

          <div>
            <Button
              type="submit"
              loading={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Entrar
            </Button>
          </div>

          <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-md">
            <h3 className="text-sm font-medium text-blue-800 mb-2">Para acessar o sistema:</h3>
            <p className="text-xs text-blue-700">
              Entre em contato com o administrador do sistema para obter suas credenciais de acesso.
              O sistema registra todas as tentativas de login para fins de auditoria.
            </p>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Login;