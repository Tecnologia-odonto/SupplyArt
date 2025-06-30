import React, { useEffect, useState } from 'react';
import { PlusIcon, PencilIcon, TrashIcon, BuildingOffice2Icon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import { supabase } from '../../lib/supabase';
import { Supplier } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { createAuditLog } from '../../utils/auditLogger';
import SupplierForm from './SupplierForm';
import toast from 'react-hot-toast';

const Suppliers: React.FC = () => {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const fetchSuppliers = async () => {
    try {
      const { data, error } = await supabase
        .from('suppliers')
        .select('*')
        .order('name');

      if (error) throw error;
      setSuppliers(data || []);
    } catch (error) {
      console.error('Error fetching suppliers:', error);
      toast.error('Erro ao carregar fornecedores');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, supplierName: string) => {
    if (!canManageSuppliers) {
      toast.error('Você não tem permissão para excluir fornecedores');
      return;
    }

    if (window.confirm(`Tem certeza que deseja excluir o fornecedor "${supplierName}"?`)) {
      try {
        const supplierToDelete = suppliers.find(s => s.id === id);
        
        const { error } = await supabase
          .from('suppliers')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setSuppliers(suppliers.filter(supplier => supplier.id !== id));
        
        // Criar log de auditoria
        await createAuditLog({
          action: 'SUPPLIER_DELETED',
          tableName: 'suppliers',
          recordId: id,
          oldValues: supplierToDelete
        });
        
        toast.success('Fornecedor excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting supplier:', error);
        toast.error('Erro ao excluir fornecedor');
      }
    }
  };

  const handleSupplierSaved = (savedSupplier: Supplier) => {
    if (editingSupplier) {
      setSuppliers(suppliers.map(supplier => 
        supplier.id === savedSupplier.id ? savedSupplier : supplier
      ));
    } else {
      setSuppliers([...suppliers, savedSupplier]);
    }
    setModalOpen(false);
    setEditingSupplier(null);
  };

  // Verificar se o usuário pode gerenciar fornecedores
  const canManageSuppliers = profile?.role && ['admin', 'gestor', 'operador-almoxarife'].includes(profile.role);

  const columns = [
    {
      key: 'name',
      title: 'Nome',
      render: (value: string, record: Supplier) => (
        <div className="flex items-center">
          <BuildingOffice2Icon className="h-5 w-5 text-gray-400 mr-3" />
          <div>
            <div className="font-medium text-gray-900">{value}</div>
            {record.cnpj && (
              <div className="text-sm text-gray-500">CNPJ: {record.cnpj}</div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'contact_person',
      title: 'Contato',
      render: (value: string) => value || '-'
    },
    {
      key: 'email',
      title: 'Email',
      render: (value: string) => value ? (
        <a href={`mailto:${value}`} className="text-primary-600 hover:text-primary-800">
          {value}
        </a>
      ) : '-'
    },
    {
      key: 'phone',
      title: 'Telefone',
      render: (value: string) => value ? (
        <a href={`tel:${value.replace(/\D/g, '')}`} className="text-primary-600 hover:text-primary-800">
          {value}
        </a>
      ) : '-'
    },
    {
      key: 'address',
      title: 'Endereço',
      render: (value: string) => value ? (
        <span title={value} className="text-sm">
          {value.length > 30 ? `${value.substring(0, 30)}...` : value}
        </span>
      ) : '-'
    },
    {
      key: 'created_at',
      title: 'Cadastrado em',
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: Supplier) => (
        <div className="flex space-x-2">
          {canManageSuppliers && (
            <>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingSupplier(record);
                  setModalOpen(true);
                }}
              >
                <PencilIcon className="w-4 h-4 mr-1" />
                Editar
              </Button>
              <Button
                size="sm"
                variant="danger"
                onClick={() => handleDelete(record.id, record.name)}
              >
                <TrashIcon className="w-4 h-4 mr-1" />
                Excluir
              </Button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (!permissions.canAccessFinancial) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar o módulo de fornecedores.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Fornecedores</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie os fornecedores do sistema
          </p>
          {canManageSuppliers && (
            <p className="mt-1 text-xs text-blue-600 font-medium">
              Você pode adicionar, editar e excluir fornecedores
            </p>
          )}
        </div>
        {canManageSuppliers && (
          <Button
            onClick={() => {
              setEditingSupplier(null);
              setModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Fornecedor
          </Button>
        )}
      </div>

      {/* Informações sobre permissões */}
      {!canManageSuppliers && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <span className="text-blue-600 text-xl">ℹ️</span>
            </div>
            <div className="ml-3">
              <h3 className="text-sm font-medium text-blue-800">Acesso Limitado</h3>
              <p className="text-sm text-blue-700 mt-1">
                Você pode visualizar os fornecedores, mas apenas Administradores, Gestores e Operadores de Almoxarifado podem gerenciá-los.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <BuildingOffice2Icon className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total de Fornecedores</p>
              <p className="text-lg font-semibold text-gray-900">{suppliers.length}</p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-sm">@</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Com Email</p>
              <p className="text-lg font-semibold text-gray-900">
                {suppliers.filter(s => s.email).length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-sm">📞</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Com Telefone</p>
              <p className="text-lg font-semibold text-gray-900">
                {suppliers.filter(s => s.phone).length}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-sm">📄</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Com CNPJ</p>
              <p className="text-lg font-semibold text-gray-900">
                {suppliers.filter(s => s.cnpj).length}
              </p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={suppliers}
          loading={loading}
          emptyMessage="Nenhum fornecedor cadastrado"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingSupplier(null);
        }}
        title={editingSupplier ? 'Editar Fornecedor' : 'Novo Fornecedor'}
        size="lg"
      >
        <SupplierForm
          supplier={editingSupplier}
          onSave={handleSupplierSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingSupplier(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Suppliers;