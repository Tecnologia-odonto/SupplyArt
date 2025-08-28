import React, { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { EyeIcon, EyeSlashIcon } from '@heroicons/react/24/outline';
import { supabase } from '../../lib/supabase';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface ResetPasswordForm {
  password: string;
  confirmPassword: string;
}

const ResetPassword: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [validatingSession, setValidatingSession] = useState(true);
  const [sessionValid, setSessionValid] = useState(false);
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const { register, handleSubmit, watch, formState: { errors } } = useForm<ResetPasswordForm>();
  
  const password = watch('password');

  useEffect(() => {
    const validateSession = async () => {
      setValidatingSession(true);
      
      // Verificar se há tokens de recuperação de senha na URL
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      const type = searchParams.get('type');

      if (type === 'recovery' && accessToken && refreshToken) {
        try {
          // Apenas validar os tokens sem fazer login automático
          // Verificar se os tokens são válidos fazendo uma chamada de teste
          const tempClient = supabase.auth.admin || supabase.auth;
          
          // Tentar usar os tokens para verificar se são válidos
          const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/user`, {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY
            }
          });
          
          if (!response.ok) {
            throw new Error('Tokens inválidos ou expirados');
          }
          
          // Tokens são válidos, permitir redefinição
          setSessionValid(true);
        } catch (error) {
          console.error('Session validation error:', error);
          toast.error('Link de recuperação inválido ou expirado');
          navigate('/login');
          return;
        }
      } else {
        // Se não há tokens válidos, redirecionar para login
        toast.error('Link de recuperação inválido ou expirado');
        navigate('/login');
        return;
      }
      
      setValidatingSession(false);
    };

    validateSession();
  }, [searchParams, navigate]);

  const onSubmit = async (data: ResetPasswordForm) => {
    if (data.password !== data.confirmPassword) {
      toast.error('As senhas não coincidem');
      return;
    }

    setLoading(true);
    try {
      // Obter tokens da URL
      const accessToken = searchParams.get('access_token');
      const refreshToken = searchParams.get('refresh_token');
      
      if (!accessToken || !refreshToken) {
        throw new Error('Tokens de recuperação não encontrados');
      }
      
      // Criar uma sessão temporária apenas para redefinir a senha
      const { error: sessionError } = await supabase.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      if (sessionError) {
        throw new Error('Não foi possível validar os tokens de recuperação');
      }
      
      // Aguardar um pouco para garantir que a sessão foi estabelecida
      await new Promise(resolve => setTimeout(resolve, 500));
      
      // Atualizar a senha
      const { error: updateError } = await supabase.auth.updateUser({
        password: data.password
      });

      if (updateError) {
        throw updateError;
      }

      toast.success('Senha alterada com sucesso! Você será redirecionado para o login.');
      
      // Fazer logout completo e redirecionar para login
      await supabase.auth.signOut();
      
      setTimeout(() => {
        navigate('/login');
      }, 2000);
    } catch (error: any) {
      console.error('Password reset error:', error);
      
      if (error.message?.includes('session_not_found') || 
          error.message?.includes('invalid_token')) {
        toast.error('Link de recuperação expirado. Solicite um novo link.');
        navigate('/login');
      } else {
        toast.error(error.message || 'Erro ao alterar senha');
      }
    } finally {
      setLoading(false);
    }
  };

  // Mostrar loading enquanto valida a sessão
  if (validatingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-sm text-gray-600">Validando link de recuperação...</p>
        </div>
      </div>
    );
  }
  
  // Se a sessão não é válida, não renderizar o formulário
  if (!sessionValid) {
    return null;
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-50 to-accent-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <div className="mx-auto h-12 w-12 sm:h-16 sm:w-16 flex items-center justify-center rounded-full bg-primary-600">
            <span className="text-lg sm:text-2xl font-bold text-white">SA</span>
          </div>
          <h2 className="mt-6 text-center text-2xl sm:text-3xl font-extrabold text-gray-900">
            Redefinir Senha
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Digite sua nova senha
          </p>
          <div className="mt-4 bg-blue-50 border border-blue-200 rounded-md p-3">
            <p className="text-xs text-blue-700 text-center">
              🔒 Link de recuperação válido. Defina sua nova senha abaixo.
            </p>
          </div>
        </div>
        
        <form className="mt-8 space-y-6" onSubmit={handleSubmit(onSubmit)}>
          <div className="space-y-4">
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700">
                Nova Senha
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.password ? 'border-error-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base`}
                  placeholder="Digite sua nova senha"
                  {...register('password', {
                    required: 'Nova senha é obrigatória',
                    minLength: {
                      value: 6,
                      message: 'Senha deve ter pelo menos 6 caracteres'
                    }
                  })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.password && (
                <p className="mt-1 text-sm text-error-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-gray-700">
                Confirmar Nova Senha
              </label>
              <div className="relative">
                <input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  className={`mt-1 appearance-none relative block w-full px-3 py-2 pr-10 border ${
                    errors.confirmPassword ? 'border-error-300' : 'border-gray-300'
                  } placeholder-gray-500 text-gray-900 rounded-md focus:outline-none focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base`}
                  placeholder="Confirme sua nova senha"
                  {...register('confirmPassword', {
                    required: 'Confirmação de senha é obrigatória',
                    validate: (value) => value === password || 'As senhas não coincidem'
                  })}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 pr-3 flex items-center"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                >
                  {showConfirmPassword ? (
                    <EyeSlashIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  ) : (
                    <EyeIcon className="h-5 w-5 text-gray-400 hover:text-gray-600" />
                  )}
                </button>
              </div>
              {errors.confirmPassword && (
                <p className="mt-1 text-sm text-error-600">{errors.confirmPassword.message}</p>
              )}
            </div>
          </div>

          <div>
            <Button
              type="submit"
              loading={loading}
              className="group relative w-full flex justify-center py-2 px-4 border border-transparent text-sm font-medium rounded-md text-white bg-primary-600 hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
            >
              Alterar Senha
            </Button>
          </div>

          <div className="text-center">
            <button
              type="button"
              className="text-sm text-primary-600 hover:text-primary-500"
              onClick={() => navigate('/login')}
            >
              Voltar ao Login
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default ResetPassword;