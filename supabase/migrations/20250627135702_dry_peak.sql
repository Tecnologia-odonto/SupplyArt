/*
  # Atualizar status de compras

  1. Alterações
    - Atualizar constraint de status para incluir novos valores
    - Manter compatibilidade com dados existentes

  2. Novos Status
    - pedido-realizado: Status inicial quando pedido é criado
    - em-cotacao: Quando está sendo cotado
    - comprado-aguardando: Comprado, aguardando recebimento
    - chegou-cd: Chegou ao Centro de Distribuição
    - enviado: Enviado para as unidades
    - erro-pedido: Erro no pedido
    - finalizado: Pedido finalizado e confirmado
*/

-- Remover constraint existente
ALTER TABLE purchases DROP CONSTRAINT IF EXISTS purchases_status_check;

-- Adicionar nova constraint com os status atualizados
ALTER TABLE purchases ADD CONSTRAINT purchases_status_check 
CHECK (status = ANY (ARRAY[
  'pedido-realizado'::text, 
  'em-cotacao'::text, 
  'comprado-aguardando'::text, 
  'chegou-cd'::text, 
  'enviado'::text, 
  'erro-pedido'::text, 
  'finalizado'::text
]));

-- Atualizar status existentes que podem ter mudado
UPDATE purchases 
SET status = 'comprado-aguardando' 
WHERE status = 'comprado';