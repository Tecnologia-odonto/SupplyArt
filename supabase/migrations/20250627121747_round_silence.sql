/*
  # Insert Sample Data

  1. Sample Data
    - Insert sample units (CD and branches)
    - Insert sample items across different categories
    - Insert sample suppliers
    - Insert sample stock data for all units
    - Insert sample inventory data with different statuses
    - Insert sample purchase data (without user dependencies)

  2. Notes
    - Removed user-dependent data (profiles, purchases with users, movements, audit logs)
    - These will be created when actual users sign up and use the system
    - Focus on core master data that doesn't require authentication
*/

-- Insert sample units
INSERT INTO units (id, name, description, address, is_cd) VALUES
('550e8400-e29b-41d4-a716-446655440001', 'Centro de Distribuição', 'Centro de Distribuição Principal', 'Av. Industrial, 1000 - São Paulo, SP', true),
('550e8400-e29b-41d4-a716-446655440002', 'Filial Norte', 'Filial da Zona Norte', 'Rua das Palmeiras, 200 - São Paulo, SP', false),
('550e8400-e29b-41d4-a716-446655440003', 'Filial Sul', 'Filial da Zona Sul', 'Av. Paulista, 500 - São Paulo, SP', false),
('550e8400-e29b-41d4-a716-446655440004', 'Filial Leste', 'Filial da Zona Leste', 'Rua do Comércio, 300 - São Paulo, SP', false);

-- Insert sample items
INSERT INTO items (id, code, name, description, unit_measure, category) VALUES
('660e8400-e29b-41d4-a716-446655440001', 'PAP001', 'Papel A4 75g', 'Papel sulfite A4 branco 75g/m²', 'un', 'Papelaria'),
('660e8400-e29b-41d4-a716-446655440002', 'CAN001', 'Caneta Azul BIC', 'Caneta esferográfica azul', 'un', 'Papelaria'),
('660e8400-e29b-41d4-a716-446655440003', 'LAP001', 'Lápis HB', 'Lápis grafite HB', 'un', 'Papelaria'),
('660e8400-e29b-41d4-a716-446655440004', 'TON001', 'Toner HP LaserJet', 'Cartucho de toner para impressora HP', 'un', 'Informática'),
('660e8400-e29b-41d4-a716-446655440005', 'DET001', 'Detergente 500ml', 'Detergente líquido neutro', 'un', 'Limpeza'),
('660e8400-e29b-41d4-a716-446655440006', 'LIM001', 'Álcool Gel 70%', 'Álcool em gel para limpeza', 'un', 'Limpeza'),
('660e8400-e29b-41d4-a716-446655440007', 'CAF001', 'Café Solúvel 200g', 'Café solúvel tradicional', 'un', 'Alimentação'),
('660e8400-e29b-41d4-a716-446655440008', 'ACU001', 'Açúcar Cristal 1kg', 'Açúcar cristal refinado', 'kg', 'Alimentação');

-- Insert sample suppliers
INSERT INTO suppliers (id, name, contact_person, email, phone, cnpj) VALUES
('770e8400-e29b-41d4-a716-446655440001', 'Papelaria Central Ltda', 'João Silva', 'joao@papelariacentral.com.br', '(11) 1234-5678', '12.345.678/0001-90'),
('770e8400-e29b-41d4-a716-446655440002', 'InfoTech Suprimentos', 'Maria Santos', 'maria@infotech.com.br', '(11) 9876-5432', '98.765.432/0001-10'),
('770e8400-e29b-41d4-a716-446655440003', 'Limpeza Total S.A.', 'Pedro Oliveira', 'pedro@limpezatotal.com.br', '(11) 5555-1234', '11.222.333/0001-44'),
('770e8400-e29b-41d4-a716-446655440004', 'Distribuidor de Alimentos ABC', 'Ana Costa', 'ana@alimentosabc.com.br', '(11) 7777-8888', '44.555.666/0001-77');

-- Insert sample stock data
INSERT INTO stock (item_id, unit_id, quantity, min_quantity, max_quantity, location) VALUES
-- CD stock
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 500, 100, 1000, 'Estante A1'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 200, 50, 500, 'Estante A2'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 150, 30, 300, 'Estante A2'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 25, 5, 50, 'Estante B1'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 100, 20, 200, 'Estante C1'),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', 80, 15, 150, 'Estante C1'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 60, 10, 100, 'Estante D1'),
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', 40, 10, 80, 'Estante D1'),

-- Filial Norte stock
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 50, 10, 100, 'Armário 1'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 30, 10, 50, 'Armário 1'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 10, 5, 20, 'Armário 2'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', 5, 2, 10, 'Copa'),

-- Filial Sul stock
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 40, 10, 80, 'Sala de Material'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 25, 5, 50, 'Sala de Material'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 2, 1, 5, 'TI'),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 15, 5, 30, 'Limpeza'),

-- Filial Leste stock
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 35, 10, 70, 'Depósito'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 20, 5, 40, 'Depósito'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440004', 8, 3, 15, 'Limpeza'),
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', 3, 2, 8, 'Copa');

-- Insert sample inventory data
INSERT INTO inventory (item_id, unit_id, quantity, location, status, notes) VALUES
-- CD inventory
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440001', 500, 'Estante A1', 'available', 'Estoque principal'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 180, 'Estante A2', 'available', 'Estoque regular'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440001', 20, 'Estante A2', 'reserved', 'Reservado para Filial Norte'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440001', 150, 'Estante A2', 'available', 'Lápis novos'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 23, 'Estante B1', 'available', 'Toners novos'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440001', 2, 'Estante B1', 'damaged', 'Embalagem danificada'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440001', 100, 'Estante C1', 'available', 'Detergente estoque'),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440001', 80, 'Estante C1', 'available', 'Álcool gel disponível'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 55, 'Estante D1', 'available', 'Café para distribuição'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440001', 5, 'Estante D1', 'expired', 'Vencido - próximo ao descarte'),
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440001', 40, 'Estante D1', 'available', 'Açúcar disponível'),

-- Filial Norte inventory
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440002', 50, 'Armário 1', 'available', 'Estoque local'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440002', 30, 'Armário 1', 'available', 'Canetas disponíveis'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440002', 10, 'Armário 2', 'available', 'Detergente limpeza'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', 4, 'Copa', 'available', 'Café para funcionários'),
('660e8400-e29b-41d4-a716-446655440007', '550e8400-e29b-41d4-a716-446655440002', 1, 'Copa', 'expired', 'Vencido - descartar'),

-- Filial Sul inventory
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440003', 40, 'Sala de Material', 'available', 'Papel disponível'),
('660e8400-e29b-41d4-a716-446655440002', '550e8400-e29b-41d4-a716-446655440003', 25, 'Sala de Material', 'available', 'Canetas azuis'),
('660e8400-e29b-41d4-a716-446655440004', '550e8400-e29b-41d4-a716-446655440003', 2, 'TI', 'available', 'Toner reserva'),
('660e8400-e29b-41d4-a716-446655440006', '550e8400-e29b-41d4-a716-446655440003', 15, 'Limpeza', 'available', 'Álcool gel'),

-- Filial Leste inventory
('660e8400-e29b-41d4-a716-446655440001', '550e8400-e29b-41d4-a716-446655440004', 35, 'Depósito', 'available', 'Papel A4 estoque'),
('660e8400-e29b-41d4-a716-446655440003', '550e8400-e29b-41d4-a716-446655440004', 20, 'Depósito', 'available', 'Lápis HB'),
('660e8400-e29b-41d4-a716-446655440005', '550e8400-e29b-41d4-a716-446655440004', 8, 'Limpeza', 'available', 'Detergente'),
('660e8400-e29b-41d4-a716-446655440008', '550e8400-e29b-41d4-a716-446655440004', 3, 'Copa', 'available', 'Açúcar copa');