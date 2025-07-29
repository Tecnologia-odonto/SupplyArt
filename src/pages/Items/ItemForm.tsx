import React from 'react';
import { useForm } from 'react-hook-form';
import { supabase } from '../../lib/supabase';
import { Item } from '../../types/database';
import Button from '../../components/UI/Button';
import toast from 'react-hot-toast';

interface ItemFormProps {
  item?: Item | null;
  onSave: (item: Item) => void;
  onCancel: () => void;
}

interface FormData {
  code: string;
  name: string;
  description: string;
  unit_measure: string;
  category: string;
  show_in_company: boolean;
  has_lifecycle: boolean;
  requires_maintenance: boolean;
}

const ItemForm: React.FC<ItemFormProps> = ({ item, onSave, onCancel }) => {
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormData>({
    defaultValues: {
      code: item?.code || '',
      name: item?.name || '',
      description: item?.description || '',
      unit_measure: item?.unit_measure || '',
      category: item?.category || '',
      show_in_company: item?.show_in_company ?? true,
      has_lifecycle: item?.has_lifecycle ?? false,
      requires_maintenance: item?.requires_maintenance ?? false,
    }
  });

  const watchedHasLifecycle = watch('has_lifecycle');
  const watchedName = watch('name');
  const watchedCategory = watch('category');

  // Função para gerar código automático
  const generateItemCode = (name: string, category: string): string => {
    if (!name || !category) return '';
    
    // Remover acentos e caracteres especiais, converter para maiúsculo
    const cleanString = (str: string) => {
      return str
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '') // Remove acentos
        .replace(/[^a-zA-Z]/g, '') // Remove caracteres especiais
        .toUpperCase();
    };
    
    // Pegar 2 primeiras letras do nome
    const namePrefix = cleanString(name).substring(0, 2).padEnd(2, 'X');
    
    // Pegar 2 primeiras letras da categoria
    const categoryPrefix = cleanString(category).substring(0, 2).padEnd(2, 'X');
    
    // Gerar 6 dígitos aleatórios
    const randomDigits = Math.floor(100000 + Math.random() * 900000).toString();
    
    return `${namePrefix}${categoryPrefix}${randomDigits}`;
  };

  // Gerar código automaticamente quando nome e categoria mudarem (apenas para novos itens)
  React.useEffect(() => {
    if (!item && watchedName && watchedCategory) {
      const newCode = generateItemCode(watchedName, watchedCategory);
      setValue('code', newCode);
    }
  }, [watchedName, watchedCategory, item, setValue]);

  const onSubmit = async (data: FormData) => {
    try {
      // Se for um novo item e não tem código, gerar automaticamente
      if (!item && !data.code && data.name && data.category) {
        data.code = generateItemCode(data.name, data.category);
      }

      const itemData = {
        code: data.code,
        name: data.name,
        description: data.description || null,
        unit_measure: data.unit_measure,
        category: data.category || null,
        show_in_company: data.show_in_company,
        has_lifecycle: data.has_lifecycle,
        requires_maintenance: data.requires_maintenance,
      };

      let result;
      if (item) {
        result = await supabase
          .from('items')
          .update(itemData)
          .eq('id', item.id)
          .select()
          .single();
      } else {
        result = await supabase
          .from('items')
          .insert(itemData)
          .select()
          .single();
      }

      if (result.error) throw result.error;

      onSave(result.data);
      toast.success(item ? 'Item atualizado com sucesso!' : 'Item criado com sucesso!');
    } catch (error: any) {
      console.error('Error saving item:', error);
      if (error.code === '23505' && error.message.includes('items_code_key')) {
        toast.error('Código já existe. Gerando novo código...');
        // Regenerar código e tentar novamente
        if (!item && watchedName && watchedCategory) {
          const newCode = generateItemCode(watchedName, watchedCategory);
          setValue('code', newCode);
        }
      } else {
        toast.error(error.message || 'Erro ao salvar item');
      }
    }
  };

  const unitMeasures = [
    'un',
    'cx',
    'kg',
    'g',
    'l',
    'ml',
    'm',
    'cm',
    'pç',
    'par',
    'dz',
  ];

  const categories = [
    'Material de Escritório',
    'Material de Limpeza',
    'Insumo Odontológico',
    'Equipamento de Informática',
    'Medicação',
    'Equipamento Odontológico',
    'Instrumental Odontológico',
    'Material Gráfico',
    'Peças de Equipamento Odontológico',
  ];

  return (
    <div className="space-y-4">
      <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
        <h4 className="text-sm font-medium text-blue-800 mb-2">🏷️ Código Automático</h4>
        <p className="text-xs text-blue-700">
          O código é gerado automaticamente: <strong>2 letras do nome + 2 letras da categoria + 6 dígitos aleatórios</strong>
          <br />
          Exemplo: "Papel A4" + "Material de Escritório" = <code>PAMA123456</code>
        </p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="code" className="block text-sm font-medium text-gray-700 flex items-center">
              Código * 
              {!item && (
                <span className="ml-2 text-xs text-green-600 bg-green-100 px-2 py-1 rounded">
                  Gerado automaticamente
                </span>
              )}
            </label>
            <input
              id="code"
              type="text"
              readOnly={!item}
              placeholder={!item ? "Será gerado automaticamente..." : ""}
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.code ? 'border-error-300' : ''
              } ${!item ? 'bg-gray-50' : ''}`}
              {...register('code', { required: 'Código é obrigatório' })}
            />
            {errors.code && (
              <p className="mt-1 text-sm text-error-600">{errors.code.message}</p>
            )}
            {!item && (
              <p className="mt-1 text-xs text-gray-500">
                💡 Preencha o nome e categoria para gerar o código automaticamente
              </p>
            )}
          </div>

          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700">
              Nome *
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
        </div>

        <div>
          <label htmlFor="description" className="block text-sm font-medium text-gray-700">
            Descrição
          </label>
          <textarea
            id="description"
            rows={3}
            className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm"
            {...register('description')}
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="unit_measure" className="block text-sm font-medium text-gray-700">
              Unidade de Medida *
            </label>
            <select
              id="unit_measure"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.unit_measure ? 'border-error-300' : ''
              }`}
              {...register('unit_measure', { required: 'Unidade de medida é obrigatória' })}
            >
              <option value="">Selecione uma unidade</option>
              {unitMeasures.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            {errors.unit_measure && (
              <p className="mt-1 text-sm text-error-600">{errors.unit_measure.message}</p>
            )}
          </div>

          <div>
            <label htmlFor="category" className="block text-sm font-medium text-gray-700">
              Categoria {!watchedHasLifecycle ? '*' : ''}
            </label>
            <select
              id="category"
              className={`mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 sm:text-sm ${
                errors.category ? 'border-error-300' : ''
              }`}
              {...register('category', { 
                required: !watchedHasLifecycle ? 'Categoria é obrigatória' : false 
              })}
            >
              <option value="">Selecione uma categoria</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
            {errors.category && (
              <p className="mt-1 text-sm text-error-600">{errors.category.message}</p>
            )}
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center">
            <input
              id="show_in_company"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              {...register('show_in_company')}
            />
            <label htmlFor="show_in_company" className="ml-2 block text-sm text-gray-900">
              Exibir na empresa
            </label>
            <span className="ml-2 text-xs text-gray-500">
              (Determina se o item aparece na listagem de compras)
            </span>
          </div>

          <div className="flex items-center">
            <input
              id="has_lifecycle"
              type="checkbox"
              className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
              {...register('has_lifecycle')}
            />
            <label htmlFor="has_lifecycle" className="ml-2 block text-sm text-gray-900">
              Tem vida útil
            </label>
            <span className="ml-2 text-xs text-gray-500">
              (Permite controle individual de cada item no inventário)
            </span>
          </div>

          {watchedHasLifecycle && (
            <div className="flex items-center">
              <input
                id="requires_maintenance"
                type="checkbox"
                className="h-4 w-4 text-primary-600 focus:ring-primary-500 border-gray-300 rounded"
                {...register('requires_maintenance')}
              />
              <label htmlFor="requires_maintenance" className="ml-2 block text-sm text-gray-900">
                Requer manutenção preventiva *
              </label>
            </div>
          )}

          {watchedHasLifecycle && (
            <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
              <h5 className="text-sm font-medium text-blue-800 mb-2">Exemplos de Manutenção Preventiva:</h5>
              <div className="text-xs text-blue-700 space-y-1">
                <p><strong>SIM:</strong> Computador Desktop, Notebook, Impressora, Ar Condicionado, Equipamento Odontológico</p>
                <p><strong>NÃO:</strong> Móveis, Periféricos, Tablet, Smartphone, Instrumental</p>
              </div>
            </div>
          )}
        </div>

        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <h4 className="text-sm font-medium text-blue-800 mb-2">ℹ️ Sobre o Catálogo de Itens</h4>
          <p className="text-xs text-blue-700">
            Este módulo serve como catálogo de produtos. A quantidade é controlada nos módulos de Estoque e Inventário.
            Use "Exibir na empresa" para definir quais itens aparecem nas compras.
          </p>
        </div>

        <div className="flex justify-end space-x-3 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" loading={isSubmitting}>
            {item ? 'Atualizar' : 'Criar'} Item
          </Button>
        </div>
      </form>
    </div>
  );
};

export default ItemForm;