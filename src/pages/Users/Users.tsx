import React, { useEffect, useState } from 'react';
import { PlusIcon, UserIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { Profile } from '../../types/database';
import { usePermissions } from '../../hooks/usePermissions';
import UserForm from './UserForm';
import toast from 'react-hot-toast';

interface ProfileWithUnit extends Profile {
  unit: {
    name: string;
  } | null;
}

const Users: React.FC = () => {
  const [users, setUsers] = useState<ProfileWithUnit[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<Profile | null>(null);
  const permissions = usePermissions();

  useEffect(() => {
    fetchUsers();
  }, []);

  const fetchUsers = async () => {
    try {
      const { data, error } = await supabase
        .from('profiles')
        .select(`
          *,
          unit:units(name)
        `)
        .order('name');

      if (error) throw error;
      setUsers(data || []);
    } catch (error) {
      console.error('Error fetching users:', error);
      toast.error('Erro ao carregar usuários');
    } finally {
      setLoading(false);
    }
  };

  const handleUserSaved = () => {
    fetchUsers();
    setModalOpen(false);
    setEditingUser(null);
  };

  const handleDelete = async (id: string) => {
    if (!permissions.canDelete) {
      toast.error('Você não tem permissão para excluir usuários');
      return;
    }

    if (window.confirm('Tem certeza que deseja excluir este usuário?')) {
      try {
        const { error } = await supabase
          .from('profiles')
          .delete()
          .eq('id', id);

        if (error) throw error;
        
        setUsers(users.filter(user => user.id !== id));
        toast.success('Usuário excluído com sucesso!');
      } catch (error) {
        console.error('Error deleting user:', error);
        toast.error('Erro ao excluir usuário');
      }
    }
  };

  const getRoleBadge = (role: string) => {
    const roleMap = {
      admin: { variant: 'error' as const, label: 'Administrador' },
      gestor: { variant: 'warning' as const, label: 'Gestor' },
      'operador-financeiro': { variant: 'info' as const, label: 'Op. Financeiro' },
      'operador-administrativo': { variant: 'success' as const, label: 'Op. Administrativo' },
      'operador-almoxarife': { variant: 'default' as const, label: 'Op. Almoxarife' },
    };

    const roleInfo = roleMap[role as keyof typeof roleMap] || { variant: 'default' as const, label: role };
    return <Badge variant={roleInfo.variant}>{roleInfo.label}</Badge>;
  };

  const columns = [
    {
      key: 'name',
      title: 'Nome',
      render: (value: string, record: ProfileWithUnit) => (
        <div className="flex items-center">
          <div className="flex-shrink-0 h-8 w-8">
            <div className="h-8 w-8 rounded-full bg-primary-100 flex items-center justify-center">
              <UserIcon className="h-4 w-4 text-primary-600" />
            </div>
          </div>
          <div className="ml-3">
            <div className="font-medium text-gray-900">{value}</div>
            <div className="text-sm text-gray-500">{record.email}</div>
            {record.unit && (
              <div className="text-xs text-blue-600">
                {record.role === 'operador-almoxarife' ? 'CD: ' : 'Unidade: '}{record.unit.name}
              </div>
            )}
          </div>
        </div>
      )
    },
    {
      key: 'role',
      title: 'Função',
      render: (value: string) => getRoleBadge(value)
    },
    {
      key: 'unit',
      title: 'Unidade',
      render: (unit: any, record: ProfileWithUnit) => {
        if (!unit) return 'Todas as unidades';
        
        if (record.role === 'operador-almoxarife') {
          return `${unit.name} (CD)`;
        }
        
        return unit.name;
      }
    },
    {
      key: 'created_at',
      title: 'Cadastrado em',
      render: (value: string) => new Date(value).toLocaleDateString('pt-BR')
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: ProfileWithUnit) => (
        <div className="flex space-x-2">
          {permissions.canUpdate && (
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setEditingUser(record);
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

  const roleCounts = users.reduce((acc, user) => {
    acc[user.role] = (acc[user.role] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  if (!permissions.canManageUsers) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para gerenciar usuários.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Usuários</h1>
          <p className="mt-1 text-sm text-gray-600">
            Gerencie usuários e suas permissões
          </p>
        </div>
        {permissions.canCreate && (
          <Button
            onClick={() => {
              setEditingUser(null);
              setModalOpen(true);
            }}
          >
            <PlusIcon className="w-4 h-4 mr-2" />
            Novo Usuário
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-error-100 rounded-full flex items-center justify-center">
                <span className="text-error-600 font-semibold text-sm">A</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Admins</p>
              <p className="text-lg font-semibold text-gray-900">
                {roleCounts.admin || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-warning-100 rounded-full flex items-center justify-center">
                <span className="text-warning-600 font-semibold text-sm">G</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Gestores</p>
              <p className="text-lg font-semibold text-gray-900">
                {roleCounts.gestor || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-sm">F</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Financeiro</p>
              <p className="text-lg font-semibold text-gray-900">
                {roleCounts['operador-financeiro'] || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-sm">O</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Operadores</p>
              <p className="text-lg font-semibold text-gray-900">
                {(roleCounts['operador-administrativo'] || 0) + (roleCounts['operador-almoxarife'] || 0)}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <UserIcon className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">{users.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={users}
          loading={loading}
          emptyMessage="Nenhum usuário encontrado"
        />
      </Card>

      <Modal
        isOpen={modalOpen}
        onClose={() => {
          setModalOpen(false);
          setEditingUser(null);
        }}
        title={editingUser ? 'Editar Usuário' : 'Novo Usuário'}
        size="lg"
      >
        <UserForm
          user={editingUser}
          onSave={handleUserSaved}
          onCancel={() => {
            setModalOpen(false);
            setEditingUser(null);
          }}
        />
      </Modal>
    </div>
  );
};

export default Users;