/*
  # Fix User Creation and Audit Log Triggers

  1. Changes
    - Replace handle_new_user function with handle_auth_user_created
    - Create improved handle_audit_log function
    - Drop existing triggers and recreate them
    - Fix error handling in both functions
*/

-- 1) Função da trigger para criação de profile ao criar usuário no auth.users
CREATE OR REPLACE FUNCTION public.handle_auth_user_created()
RETURNS TRIGGER AS $$
BEGIN
  BEGIN
    INSERT INTO public.profiles (
      id, name, email, role, created_at, updated_at
    )
    VALUES (
      NEW.id,
      COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
      NEW.email,
      COALESCE(NEW.raw_user_meta_data->>'role', 'operador-administrativo'),
      now(),
      now()
    )
    ON CONFLICT (id) DO NOTHING;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro na trigger handle_auth_user_created: %', SQLERRM;
  END;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2) Função da trigger para criar logs de auditoria
CREATE OR REPLACE FUNCTION public.handle_audit_log()
RETURNS TRIGGER AS $$
DECLARE
  user_id_val uuid;
BEGIN
  BEGIN
    user_id_val := auth.uid();
  EXCEPTION WHEN OTHERS THEN
    user_id_val := NULL;
  END;

  BEGIN
    IF TG_OP = 'DELETE' THEN
      INSERT INTO audit_logs (
        user_id, action, table_name, record_id, old_values
      ) VALUES (
        user_id_val,
        'DELETE',
        TG_TABLE_NAME,
        OLD.id::text,
        row_to_json(OLD)
      );
      RETURN OLD;

    ELSIF TG_OP = 'UPDATE' THEN
      INSERT INTO audit_logs (
        user_id, action, table_name, record_id, old_values, new_values
      ) VALUES (
        user_id_val,
        'UPDATE',
        TG_TABLE_NAME,
        NEW.id::text,
        row_to_json(OLD),
        row_to_json(NEW)
      );
      RETURN NEW;

    ELSIF TG_OP = 'INSERT' THEN
      INSERT INTO audit_logs (
        user_id, action, table_name, record_id, new_values
      ) VALUES (
        user_id_val,
        'INSERT',
        TG_TABLE_NAME,
        NEW.id::text,
        row_to_json(NEW)
      );
      RETURN NEW;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'Erro na trigger handle_audit_log: %', SQLERRM;
  END;

  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 3) Drop triggers antigas se existirem
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS audit_trigger_profiles ON public.profiles;

-- 4) Criar triggers novas usando as funções acima
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_auth_user_created();

CREATE TRIGGER audit_trigger_profiles
AFTER INSERT OR UPDATE OR DELETE ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.handle_audit_log();

-- Adicionar comentários para documentação
COMMENT ON FUNCTION public.handle_auth_user_created() IS 'Cria automaticamente um perfil quando um usuário é criado no auth.users';
COMMENT ON FUNCTION public.handle_audit_log() IS 'Registra alterações nas tabelas para auditoria';