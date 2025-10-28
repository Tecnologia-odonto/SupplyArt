import React, { useEffect, useState } from 'react';
import { formatDBDateForDisplay, getTodayBrazilForInput} from '../../utils/dateHelper';
import { DocumentTextIcon, EyeIcon, CalendarIcon } from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import toast from 'react-hot-toast';

interface AuditLogWithProfile {
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
  const [logs, setLogs] = useState<AuditLogWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [selectedLog, setSelectedLog] = useState<AuditLogWithProfile | null>(null);
  const [startDate, setStartDate] = useState(() => {
    const date = new Date();
    date.setDate(date.getDate() - 7); // Últimos 7 dias por padrão
    return date.toISOString().split('T')[0];
  });
  const [endDate, setEndDate] = useState(() => {
    return getTodayBrazilForInput();
  });
  const permissions = usePermissions();

  useEffect(() => {
    if (permissions.canAccessLogs) {
      fetchLogs();
    }
  }, [startDate, endDate, permissions.canAccessLogs]);

  const fetchLogs = async () => {
    try {
      const { data, error } = await supabase
        .from('audit_logs')
        .select(`
          *,
          user:profiles(name, email)
        `)
        .gte('created_at', startDate + 'T00:00:00')
        .lte('created_at', endDate + 'T23:59:59')
        .order('created_at', { ascending: false })
        .limit(1000); // Limitar para performance

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
      profiles: 'Usuários',
      units: 'Unidades',
      items: 'Itens',
      suppliers: 'Fornecedores',
      stock: 'Estoque',
      inventory: 'Inventário',
      inventory_items: 'Itens de Inventário',
      inventory_events: 'Eventos de Inventário',
      requests: 'Pedidos Internos',
      request_items: 'Itens de Pedidos',
      purchases: 'Compras',
      purchase_items: 'Itens de Compras',
      movements: 'Movimentações',
      financial_transactions: 'Transações Financeiras',
      unit_budgets: 'Orçamentos',
      auth: 'Autenticação',
    };

    return tableNames[tableName] || tableName;
  };

  const columns = [
    {
      key: 'user',
      title: 'Usuário',
      render: (user: any) => (
        <div>
          <div className="font-medium text-gray-900">{user?.name || 'Sistema'}</div>
          <div className="text-sm text-gray-500">{user?.email || '-'}</div>
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
      render: (value: string) => getTableDisplayName(value)
    },
    {
      key: 'record_id',
      title: 'Registro',
      render: (value: string) => value ? (
        <span className="font-mono text-xs">{value.slice(0, 8)}...</span>
      ) : '-'
    },
    {
      key: 'created_at',
      title: 'Data/Hora',
      render: (value: string) => (
        <div>
          <div className="text-sm">{formatDBDateForDisplay(value)}</div>
          <div className="text-xs text-gray-500">{new Date(value).toLocaleTimeString('pt-BR')}</div>
        </div>
      )
    },
    {
      key: 'actions',
      title: 'Ações',
      render: (_: any, record: AuditLogWithProfile) => (
        <Button
          size="sm"
          variant="ghost"
          onClick={() => {
            setSelectedLog(record);
            setDetailsModalOpen(true);
          }}
        >
          <EyeIcon className="w-4 h-4" />
        </Button>
      ),
    },
  ];

  if (!permissions.canAccessLogs) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="text-center">
          <h3 className="text-lg font-medium text-gray-900">Acesso Negado</h3>
          <p className="text-gray-500">Você não tem permissão para acessar os logs de auditoria.</p>
        </div>
      </div>
    );
  }

  const actionCounts = logs.reduce((acc, log) => {
    if (log.action.includes('CREATE') || log.action.includes('INSERT')) {
      acc.creates = (acc.creates || 0) + 1;
    } else if (log.action.includes('UPDATE')) {
      acc.updates = (acc.updates || 0) + 1;
    } else if (log.action.includes('DELETE')) {
      acc.deletes = (acc.deletes || 0) + 1;
    } else {
      acc.others = (acc.others || 0) + 1;
    }
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Logs de Auditoria</h1>
          <p className="mt-1 text-sm text-gray-600">
            Histórico completo de ações realizadas no sistema
          </p>
        </div>
      </div>

      {/* Filtros de Data */}
      <Card>
        <div className="flex items-center mb-4">
          <CalendarIcon className="w-5 h-5 text-primary-600 mr-2" />
          <h3 className="text-lg font-medium text-gray-900">Filtros de Período</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="start_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Inicial
            </label>
            <input
              id="start_date"
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
          
          <div>
            <label htmlFor="end_date" className="block text-sm font-medium text-gray-700 mb-1">
              Data Final
            </label>
            <input
              id="end_date"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="block w-full rounded-md border-gray-300 shadow-sm focus:border-primary-500 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              setStartDate(today);
              setEndDate(today);
            }}
          >
            Hoje
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              const lastWeek = new Date();
              lastWeek.setDate(lastWeek.getDate() - 7);
              setStartDate(lastWeek.toISOString().split('T')[0]);
              setEndDate(today);
            }}
          >
            Última Semana
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const today = getTodayBrazilForInput();
              const lastMonth = new Date();
              lastMonth.setMonth(lastMonth.getMonth() - 1);
              setStartDate(lastMonth.toISOString().split('T')[0]);
              setEndDate(today);
            }}
          >
            Último Mês
          </Button>
        </div>
      </Card>

      {/* Estatísticas */}
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
                {actionCounts.creates || 0}
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
                {actionCounts.updates || 0}
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
                {actionCounts.deletes || 0}
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

      {/* Tabela de Logs */}
      <Card padding={false}>
        <Table
          columns={columns}
          data={logs}
          loading={loading}
          emptyMessage={`Nenhum log encontrado no período de ${formatDBDateForDisplay(startDate)} até ${formatDBDateForDisplay(endDate)}`}
        />
      </Card>

      {/* Modal de Detalhes */}
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
                <label className="block text-sm font-medium text-gray-500">Usuário</label>
                <p className="mt-1 text-sm text-gray-900">
                  {selectedLog.user?.name || 'Sistema'} ({selectedLog.user?.email || 'N/A'})
                </p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Ação</label>
                <div className="mt-1">{getActionBadge(selectedLog.action)}</div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">Tabela</label>
                <p className="mt-1 text-sm text-gray-900">{getTableDisplayName(selectedLog.table_name)}</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-500">ID do Registro</label>
                <p className="mt-1 text-sm text-gray-900 font-mono">
                  {selectedLog.record_id || 'N/A'}
                </p>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-500">Data/Hora</label>
                <p className="mt-1 text-sm text-gray-900">
                  {new Date(selectedLog.created_at).toLocaleString('pt-BR')}
                </p>
              </div>
            </div>

            {selectedLog.old_values && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Valores Anteriores</label>
                <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.old_values, null, 2)}
                </pre>
              </div>
            )}

            {selectedLog.new_values && (
              <div>
                <label className="block text-sm font-medium text-gray-500 mb-2">Valores Novos</label>
                <pre className="bg-gray-100 p-3 rounded-md text-xs overflow-auto max-h-40">
                  {JSON.stringify(selectedLog.new_values, null, 2)}
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