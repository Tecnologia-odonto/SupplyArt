import React from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Supplier } from '../../types/database';
import Button from '../../components/UI/Button';
import { createAuditLog } from '../../utils/auditLogger';
import toast from 'react-hot-toast';

interface SupplierFormProps {
  supplier?: Supplier | null;
  onSave: (supplier: Supplier) => void;
  onCancel: () => void;
}

interface FormData {
  name: string;
  contact_person: string;
  email: string;
  phone: string;
  address: string;
  cnpj: string;
}

const SupplierForm: React.FC<SupplierFormProps> = ({ supplier, onSave, onCancel }) => {
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      name: supplier?.name || '',
      contact_person: supplier?.contact_person || '',
      email: supplier?.email || '',
      phone: supplier?.phone || '',
      address: supplier?.address || '',
      cnpj: supplier?.cnpj || '',
    }
  });

  const onSubmit = async (data: FormData) => {
    try {
      const supplierData = {
        name: data.name,
        contact_person: data.contact_person || null,
        email: data.email || null,
        phone: data.phone || null,
        address: data.address || null,
        cnpj: data.cnpj || null,
      };

      let result;
      if (supplier) {
        const oldValues = { ...supplier };
        
        result = await supabase
          .from('suppliers')
          .update(supplierData)
          .eq('id', supplier.id)
          .select()
          .single();

        if (result.error) throw result.error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'SUPPLIER_UPDATED',
          tableName: 'suppliers',
          recordId: supplier.id,
          oldValues,
          newValues: supplierData
        });
      } else {
        result = await supabase
          .from('suppliers')
          .insert(supplierData)
          .select()
          .single();

        if (result.error) throw result.error;

        // Criar log de auditoria
        await createAuditLog({
          action: 'SUPPLIER_CREATED',
          tableName: 'suppliers',
          recordId: result.data.id,
          newValues: supplierData
        });
      }

      onSave(result.data);
      toast.success(supplier ? 'Fornecedor atualizado com sucesso!' : 'Fornecedor criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving supplier:', error);
      toast.error(error.message || 'Erro ao salvar fornecedor');
    }
  };

  const formatCNPJ = (value: string) => {
    // Remove tudo que não é dígito
    const cnpj = value.replace(/\D/g, '');
    
    // Aplica a máscara XX.XXX.XXX/XXXX-XX
    return cnpj
      .replace(/(\d{2})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2')
      .replace(/(-\d{2})\d+?$/, '$1');
  };

  const formatPhone = (value: string) => {
    // Remove tudo que não é dígito
    const phone = value.replace(/\D/g, '');
    
    // Aplica a máscara (XX) XXXXX-XXXX ou (XX) XXXX-XXXX
    if (phone.length <= 10) {
      return phone
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{4})(\d)/, '$1-$2');
    } else {
      return phone
        .replace(/(\d{2})(\d)/, '($1) $2')
        .replace(/(\d{5})(\d)/, '$1-$2');
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">🏢 Cadastro de Fornecedor</h4>
        <p className="text-xs text-blue-700">
          Preencha as informações do fornecedor. Apenas o nome da empresa é obrigatório.
          Os demais campos ajudam no controle e comunicação.
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-gray-700">
            Nome da Empresa *
          </label>
          <input
            id="name"
            type="text"
            placeholder="Ex: Distribuidora ABC Ltda"
            className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
              errors.name ? 'border-error-300' : ''
            }`}
            {...register('name', { required: 'Nome da empresa é obrigatório' })}
          />
          {errors.name && (
            <p className="mt-1 text-sm text-error-600">{errors.name.message}</p>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="contact_person" className="block text-sm font-medium text-gray-700">
              Pessoa de Contato
            </label>
            <input
              id="contact_person"
              type="text"
              placeholder="Ex: João Silva"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('contact_person')}
            />
          </div>

          <div>
            <label htmlFor="cnpj" className="block text-sm font-medium text-gray-700">
              CNPJ
            </label>
            <input
              id="cnpj"
              type="text"
              maxLength={18}
              placeholder="00.000.000/0000-00"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('cnpj', {
                onChange: (e) => {
                  e.target.value = formatCNPJ(e.target.value);
                }
              })}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              placeholder="contato@empresa.com.br"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.email ? 'border-error-300' : ''
              }`}
              {...register('email', {
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
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700">
              Telefone
            </label>
            <input
              id="phone"
              type="text"
              maxLength={15}
              placeholder="(11) 99999-9999"
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
              {...register('phone', {
                onChange: (e) => {
                  e.target.value = formatPhone(e.target.value);
                }
              })}
            />
          </div>
        </div>

        <div>
          <label htmlFor="address" className="block text-sm font-medium text-gray-700">
            Endereço Completo
          </label>
          <textarea
            id="address"
            rows={3}
            placeholder="Rua, número, bairro, cidade, estado, CEP"
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('address')}
          />
        </div>

        <div className="bg-gray-50 border border-gray-200 rounded-md p-4">
          <h5 className="text-sm font-medium text-gray-800 mb-2">💡 Dicas</h5>
          <ul className="text-xs text-gray-600 space-y-1">
            <li>• O email será usado para comunicações automáticas</li>
            <li>• O telefone permite contato rápido via WhatsApp</li>
            <li>• O CNPJ é importante para emissão de notas fiscais</li>
            <li>• O endereço completo facilita entregas e correspondências</li>
          </ul>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {supplier ? 'Atualizar' : 'Criar'} Fornecedor
          </Button>
        </div>
      </form>
    </div>
  );
};

export default SupplierForm;