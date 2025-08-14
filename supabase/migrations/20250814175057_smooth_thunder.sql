/*
  # Fix requests status constraint

  1. Database Changes
    - Update the requests_status_check constraint to include 'aprovado-pendente' status
    - This status is used when a request is approved but has pending purchases

  2. Security
    - No changes to RLS policies needed
    - Maintains existing security model
*/

-- Drop the existing constraint
ALTER TABLE requests DROP CONSTRAINT IF EXISTS requests_status_check;

-- Add the updated constraint with the missing 'aprovado-pendente' status
ALTER TABLE requests ADD CONSTRAINT requests_status_check 
  CHECK (status = ANY (ARRAY[
    'solicitado'::text, 
    'analisando'::text, 
    'aprovado'::text, 
    'aprovado-pendente'::text,
    'rejeitado'::text, 
    'preparando'::text, 
    'enviado'::text, 
    'recebido'::text, 
    'aprovado-unidade'::text,
    'erro-pedido'::text,
    'cancelado'::text
  ]));