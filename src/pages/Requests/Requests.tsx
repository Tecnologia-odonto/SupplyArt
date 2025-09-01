import React, { useEffect, useState } from 'react';
import { 
  PlusIcon, 
  EyeIcon, 
  PencilIcon, 
  CheckIcon, 
  XMarkIcon,
  ClockIcon,
  TruckIcon,
  ExclamationTriangleIcon
} from '@heroicons/react/24/outline';
import Card from '../../components/UI/Card';
import Button from '../../components/UI/Button';
import Table from '../../components/UI/Table';
import Modal from '../../components/UI/Modal';
import Badge from '../../components/UI/Badge';
import { supabase } from '../../lib/supabase';
import { usePermissions } from '../../hooks/usePermissions';
import { useAuth } from '../../contexts/AuthContext';
import { createAuditLog } from '../../utils/auditLogger';
import RequestForm from './RequestForm';
import RequestDetails from './RequestDetails';
import toast from 'react-hot-toast';

interface RequestWithDetails {
  id: string;
  requesting_unit_id: string;
  status: string;
  priority: string;
  notes: string | null;
  created_at: string;
  requesting_unit: {
    name: string;
  };
  cd_unit: {
    name: string;
  };
  requester: {
    name: string;
  };
  approved_by_profile?: {
    name: string;
  } | null;
  approved_at: string | null;
  rejection_reason: string | null;
}

const Requests: React.FC = () => {
  const [requests, setRequests] = useState<RequestWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [editingRequest, setEditingRequest] = useState<any>(null);
  const [viewingRequest, setViewingRequest] = useState<any>(null);
  const permissions = usePermissions();
  const { profile } = useAuth();

  useEffect(() => {
    fetchRequests();
  }, []);

  const fetchRequests = async () => {
    try {
      let query = supabase
        .from('requests')
        .select(`
          *,
          requesting_unit:units!requests_requesting_unit_id_fkey(name),
          cd_unit:units!requests_cd_unit_id_fkey(name),
          requester:profiles!requests_requester_id_fkey(name),
          approved_by_profile:profiles!requests_approved_by_fkey(name)
        `)
        .order('created_at', { ascending: false });

      // Aplicar filtros baseados no role do usuário
      if (profile?.role === 'operador-administrativo') {
        // Op. Administrativo: apenas seus próprios pedidos
        query = query.eq('requester_id', profile.id);
      } else if (profile?.role === 'operador-financeiro' && profile.unit_id) {
        // Op. Financeiro: pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      } else if (profile?.role === 'gestor' && profile.unit_id) {
        // Gestor: pedidos da sua unidade
        query = query.eq('requesting_unit_id', profile.unit_id);
      }
      // Admin e Op. Almoxarife podem ver todos (sem filtro adicional)

      const { data, error } = await query;

      if (error) throw error;
      
      // Verificar status de compras pendentes para pedidos aprovados
      const requestsWithUpdatedStatus = await Promise.all((data || []).map(async (request) => {
        if (request.status === 'aprovado') {
          // Verificar se há compras relacionadas a este pedido
          const { data: relatedPurchases } = await supabase
            .from('purchases')
            .select('status')
            .eq('request_id', request.id);
          
          if (relatedPurchases && relatedPurchases.length > 0) {
            const hasPendingPurchases = relatedPurchases.some(purchase => 
              purchase.status !== 'finalizado'
            );
            
            if (hasPendingPurchases) {
              // Atualizar status para aprovado-pendente
              await supabase
                .from('requests')
                .update({ status: 'aprovado-pendente' })
                .eq('id', request.id);
              
              return { ...request, status: 'aprovado-pendente' };
            } else {
              // Todas as compras foram finalizadas, voltar para aprovado
              return request;
            }
          }
        }
        
        return request;
      }));
      
      // Atualizar status dos pedidos baseado em itens em rota
      const requestsWithUpdatedStatus2 = await Promise.all(requestsWithUpdatedStatus.map(async (request) => {
        // Verificar se há itens deste pedido em rota
        const { data: emRotaItems } = await supabase
          .from('em_rota')
          .select('status')
          .eq('request_id', request.id);
        
        if (emRotaItems && emRotaItems.length > 0) {
          const allDelivered = emRotaItems.every(item => item.status === 'entregue');
          const anyInTransit = emRotaItems.some(item => item.status === 'em_transito');
          
          let updatedStatus = request.status;
          
          if (allDelivered) {
            updatedStatus = 'finalizado';
          } else if (anyInTransit) {
            updatedStatus = 'em_transito';
          }
          
          if (updatedStatus !== request.status) {
            await supabase
              .from('requests')
              .update({ status: updatedStatus })
              .eq('id', request.id);
            
            return { ...request, status: updatedStatus };
          }
        }
        
        return request;
      }));
      
      setRequests(requestsWithUpdatedStatus2);
    } catch (error) {
      console.error('Erro ao buscar pedidos:', error);
      toast.error('Erro ao carregar pedidos');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      {/* Component content would go here */}
    </div>
  );
};

export default Requests;