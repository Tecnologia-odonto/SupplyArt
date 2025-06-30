import React, { useEffect, useState } from 'react';
import { DocumentTextIcon, UserIcon, ClockIcon, EyeIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import toast from 'react-hot-toast';

interface AuditLogWithDetails {
  id: string;
  action: string;
  table_name: string;
  record_id: string | null;
  old_values: any;
  new_values: any;
  created_at: string;
  user: {
    name: string;
    email: string;
  } | null;
}

const Logs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLogWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogWithDetails | null>(null);
  const [dateFilter, setDateFilter] = useState(() => {
    const today = new Date();
    const lastWeek = new Date(today);
    lastWeek.setDate(today.getDate() - 7);
    return lastWeek.toISOString().split('T')[0];
  });
  const permissions = usePermissions();

  useEffect(() => {
    if (permissions.canAccessLogs) {
      fetchLogs();
    }
  }, [dateFilter, permissions.canAccessLogs]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:profiles(name, email)
        `)
        .gte('created_at', dateFilter + 'T00:00:00')
        .order('created_at', { ascending: false })
        .limit(1000);

      if (error) throw error;
      setLogs(data || []);
    } catch (error) {
      console.error('Error fetching audit logs:', error);
      toast.error('Erro ao carregar logs de auditoria');
    } finally {
      setLoading(false);
    }
  };

  const getActionBadge = (action: string) => {
    if (action.includes('CREATE') || action.includes('INSERT')) {
      return <Badge variant="success">Criação</Badge>;
    } else if (action.includes('UPDATE')) {
      return <Badge variant="info">Atualização</Badge>;
    } else if (action.includes('DELETE')) {
      return <Badge variant="error">Exclusão</Badge>;
    } else if (action.includes('LOGIN')) {
      return <Badge variant="default">Login</Badge>;
    } else if (action.includes('LOGOUT')) {
      return <Badge variant="default">Logout</Badge>;
    } else {
      return <Badge variant="default">{action}</Badge>;
    }
  };

  const getTableDisplayName = (tableName: string) => {
    const tableNames: Record<string, string> = {
      'profiles': 'Usuários',
      'units': 'Unidades',
      'items': 'Itens',
      'suppliers': 'Fornecedores',
      'stock': 'Estoque',
      'inventory': 'Inventário',
      'inventory_items': 'Itens do Inventário',
      'inventory_events': 'Eventos do Inventário',
      'requests': 'Pedidos Internos',
      'request_items': 'Itens dos Pedidos',
      'purchases': 'Compras',
      'purchase_items': 'Itens das Compras',
      'movements': 'Movimentações',
      'financial_transactions': 'Transações Financeiras',
      'unit_budgets': 'Orçamentos',
      'auth': 'Autenticação'
    };
    return tableNames[tableName] || tableName;
  };

  const formatJsonValue = (value: any) => {
    if (value === null || value === undefined) return '-';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };

  const columns = [
    {
      key: 'created_at',
      title: 'Data/Hora',
      render: (value: string) => (
        <div className="text-sm">
          <div>{new Date(value).toLocaleDateString('pt-BR')}</div>
          <div className="text-gray-500">{new Date(value).toLocaleTimeString('pt-BR')}</div>
        </div>
      )
    },
    {
      key: 'user',
      title: 'Usuário',
      render: (user: any) => (
        <div className="flex items-center">
          <UserIcon className="h-4 w-4 text-gray-400 mr-2" />
          <div className="text-sm">
            <div className="font-medium">{user?.name || 'Sistema'}</div>
            <div className="text-gray-500 text-xs">{user?.email || '-'}</div>
          </div>
        </div>
      )
    },
    {
      key: 'action',
      title: 'Ação',
      render: (value: string) => getActionBadge(value)
    },
    {
      key: 'table_name',
      title: 'Tabela',
      render: (value: string) => (
        <span className="text-sm font-medium">{getTableDisplayName(value)}</span>
      )
    },
    {
      key: 'record_id',
      title: 'Registro',
      render: (value: string) => value ? (
        <span className="font-mono text-xs">{value.slice(0, 8)}...</span>
      ) : '-'
    },
    {
      key: 'actions',
      title: 'Detalhes',
      render: (_: any, record: AuditLogWithDetails) => (
        <button
          onClick={() => {
            setSelectedLog(record);
            setDetailsModalOpen(true);
          }}
          className="text-primary-600 hover:text-primary-800 text-sm font-medium"
        >
          <EyeIcon className="h-4 w-4" />
        </button>
      )
    }
  ];

  if (!permissions.canAccessLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem privilegios para acessar os logs de auditoria.</p>
        </div>
      </div>
    );
  }

  const actionCounts = logs.reduce((acc, log) => {
    const actionType = log.action.includes('CREATE') || log.action.includes('INSERT') ? 'create' :
                      log.action.includes('UPDATE') ? 'update' :
                      log.action.includes('DELETE') ? 'delete' : 'other';
    acc[actionType] = (acc[actionType] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-4 sm:space-y-0">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Logs de Auditoria</h1>
          <p className="mt-1 text-sm text-gray-600">
            Histórico completo de todas as operações do sistema
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <ClockIcon className="h-5 w-5 text-gray-400" />
          <input
            type="date"
            value={dateFilter}
            onChange={(e) => setDateFilter(e.target.value)}
            className="rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-success-100 rounded-full flex items-center justify-center">
                <span className="text-success-600 font-semibold text-sm">+</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Criações</p>
              <p className="text-lg font-semibold text-gray-900">
                {actionCounts.create || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-info-100 rounded-full flex items-center justify-center">
                <span className="text-info-600 font-semibold text-sm">~</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Atualizações</p>
              <p className="text-lg font-semibold text-gray-900">
                {actionCounts.update || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-error-100 rounded-full flex items-center justify-center">
                <span className="text-error-600 font-semibold text-sm">-</span>
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Exclusões</p>
              <p className="text-lg font-semibold text-gray-900">
                {actionCounts.delete || 0}
              </p>
            </div>
          </div>
        </Card>

        <Card>
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center">
                <DocumentTextIcon className="w-5 h-5 text-primary-600" />
              </div>
            </div>
            <div className="ml-3">
              <p className="text-sm font-medium text-gray-500">Total</p>
              <p className="text-lg font-semibold text-gray-900">{logs.length}</p>
            </div>
          </div>
        </Card>
      </div>

      <Card padding={false}>
        <Table
          columns={columns}
          data={logs}
          loading={loading}
          emptyMessage="Nenhum log encontrado no período selecionado"
        />
      </Card>

      <Modal
        isOpen={detailsModalOpen}
        onClose={() => {
          setDetailsModalOpen(false);
          setSelectedLog(null);
        }}
        title="Detalhes do Log de Auditoria"
        size="lg"
      >
        {selectedLog && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-500">Data/Hora</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Usuário</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLog.user?.name || 'Sistema'} ({selectedLog.user?.email || '-'})
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Ação</label>
                <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Tabela</label>
                <p className="mt-1 text-sm text-gray-900">
                  {getTableDisplayName(selectedLog.table_name)}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-500">ID do Registro</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">
                  {selectedLog.record_id || '-'}
                </p>
              </div>
            </div>

            {selectedLog.old_values && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Valores Anteriores</label>
                <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJsonValue(selectedLog.old_values)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Valores Novos</label>
                <pre className="bg-gray-50 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {formatJsonValue(selectedLog.new_values)}
                </pre>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
};

export default Logs;