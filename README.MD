# SupplyArt - Sistema de Estoque e Inventário

## 📋 Visão Geral

O **SupplyArt** é um sistema completo de gestão de estoque e inventário desenvolvido para empresas que precisam controlar materiais, equipamentos e suprimentos entre múltiplas unidades e centros de distribuição.

### 🎯 Principais Características

- **Controle Multi-Unidade**: Gestão centralizada com visibilidade por unidade
- **Fluxo Inteligente**: CD → Em Rota → Unidade com rastreamento automático
- **Controle Financeiro**: Orçamentos por unidade com consumo automático
- **Auditoria Completa**: Logs detalhados de todas as operações
- **Controle de Vida Útil**: Rastreamento individual de equipamentos
- **Sistema de Permissões**: 5 níveis de acesso com funcionalidades específicas

---

## 👥 Sistema de Usuários e Permissões

### Tipos de Usuário

#### 🔴 **Administrador**
- **Acesso**: Total ao sistema
- **Funcionalidades**: Todas as operações em todos os módulos
- **Responsabilidades**: Configuração geral, gestão de usuários, supervisão completa

#### 🟡 **Gestor**
- **Acesso**: Sua unidade específica + visão geral
- **Funcionalidades**: Gestão completa da unidade, aprovação de pedidos, relatórios
- **Responsabilidades**: Supervisão da unidade, controle de orçamento, aprovação de solicitações

#### 🔵 **Operador Financeiro**
- **Acesso**: Módulo financeiro + visualização de pedidos
- **Funcionalidades**: Gestão de orçamentos, receitas, relatórios financeiros
- **Responsabilidades**: Controle financeiro, configuração de orçamentos

#### 🟢 **Operador Administrativo**
- **Acesso**: Sua unidade específica
- **Funcionalidades**: Criação de pedidos, gestão de estoque local, inventário
- **Responsabilidades**: Operações diárias da unidade, solicitações de materiais
- **Segurança**: Logout automático após 2h de inatividade

#### 🟣 **Operador Almoxarife**
- **Acesso**: Centro de Distribuição específico
- **Funcionalidades**: Gestão de estoque CD, aprovação de pedidos, compras
- **Responsabilidades**: Controle do CD, distribuição para unidades, compras de reposição

---

## 📦 Módulos do Sistema

### 1. 🏠 **Dashboard**

#### Funcionalidades Principais
- **Visão Geral**: Estatísticas em tempo real do sistema
- **Filtros Inteligentes**: Por período, unidade e tipo de dados
- **Alertas Automáticos**: 
  - Estoque baixo
  - Itens vencidos
  - Manutenções programadas
- **Atividade Recente**: Últimas ações realizadas no sistema

#### Métricas Exibidas
- Total de itens cadastrados
- Número de unidades
- Pedidos pendentes
- Gastos do período
- Status de orçamentos

### 2. 👤 **Perfil do Usuário**

#### Funcionalidades
- **Edição de Dados**: Nome, email, setor
- **Informações do Sistema**: Função, unidade vinculada, datas
- **Segurança**: Alteração de senha via email
- **Configurações**: Preferências pessoais

### 3. 🏢 **Unidades**

#### Funcionalidades Principais
- **Cadastro de Unidades**: Filiais e Centros de Distribuição
- **Informações Completas**: Nome, descrição, endereço
- **Classificação**: Diferenciação entre Unidade e CD
- **Gestão Hierárquica**: Controle de acesso por unidade

#### Tipos de Unidade
- **Filial**: Unidade consumidora que faz pedidos
- **Centro de Distribuição (CD)**: Unidade fornecedora que atende pedidos

### 4. 📦 **Itens (Catálogo)**

#### Funcionalidades Principais
- **Catálogo Centralizado**: Base de dados de todos os produtos
- **Código Automático**: Geração inteligente baseada em nome + categoria
- **Categorização**: Organização por tipo de material
- **Controle de Exibição**: Flag para aparecer em pedidos
- **Vida Útil**: Marcação para controle individual

#### Categorias Padrão
- Material de Escritório
- Material de Limpeza
- Insumo Odontológico
- Equipamento de Informática
- Medicação
- Equipamento Odontológico
- Instrumental Odontológico
- Material Gráfico
- Peças de Equipamento

#### Unidades de Medida
- un, cx, kg, g, l, ml, m, cm, pç, par, dz

### 5. 📍 **Localizações**

#### Funcionalidades Principais
- **Organização Física**: Departamentos e locais específicos
- **Vinculação por Unidade**: Cada localização pertence a uma unidade
- **Criação Automática**: Gerada automaticamente ao usar em estoque/inventário
- **Filtros Avançados**: Por nome, descrição e unidade

#### Exemplos de Localizações
- Consultório 1, 2, 3...
- Recepção
- Administração
- Almoxarifado
- Estoque Geral

### 6. 🏪 **Fornecedores**

#### Funcionalidades Principais
- **Cadastro Completo**: Nome, contato, CNPJ, endereço
- **Formatação Automática**: CNPJ e telefone com máscaras
- **Integração**: Vinculação com compras e eventos de inventário
- **Controle de Acesso**: Apenas roles financeiros podem gerenciar

#### Informações Armazenadas
- Nome da empresa
- Pessoa de contato
- Email e telefone
- Endereço completo
- CNPJ formatado

### 7. 📊 **Estoque (Unidades)**

#### Funcionalidades Principais
- **Controle por Unidade**: Estoque específico de cada filial
- **Agrupamento Inteligente**: Soma quantidades do mesmo item
- **Limites Configuráveis**: Quantidade mínima e máxima
- **Status Automático**: Normal, Baixo, Vazio
- **Filtros Avançados**: Por unidade, item e status

#### Operações
- **Ajuste de Estoque**: Adicionar/remover quantidades
- **Movimentações Automáticas**: Registro de todas as alterações
- **Alertas**: Notificações para estoque baixo
- **Localização**: Controle de onde cada item está armazenado

### 8. 🏭 **Estoque CD (Centro de Distribuição)**

#### Funcionalidades Principais
- **Estoque Central**: Controle do CD que abastece as unidades
- **Preços Unitários**: Definição de custos para cálculo de pedidos
- **Controle de Reposição**: Limites mínimos e máximos
- **Acesso Restrito**: Apenas Admin e Operador Almoxarife

#### Características Especiais
- **Fonte de Preços**: Preços definidos aqui são usados nos pedidos
- **Agrupamento**: Soma quantidades ao invés de criar duplicatas
- **Rastreamento**: Histórico de atualizações de preço
- **Integração**: Base para o fluxo de distribuição

### 9. 🚚 **Em Rota**

#### Funcionalidades Principais
- **Rastreamento Visual**: Animação de entrega em tempo real
- **Controle de Trânsito**: Status "Em Trânsito" e "Entregue"
- **Finalização Automática**: Marca entrega e atualiza estoques
- **Integração com Pedidos**: Vinculação automática com pedidos internos

#### Fluxo de Entrega
1. **Envio**: Item sai do CD e entra "Em Rota"
2. **Trânsito**: Acompanhamento visual com tempo estimado
3. **Entrega**: Confirmação manual que atualiza estoque da unidade
4. **Finalização**: Consumo automático do orçamento

#### Animação de Rastreamento
- **Progresso Visual**: Barra de progresso com motinha animada
- **Tempo Estimado**: Cálculo baseado em 3 horas de entrega
- **Status em Tempo Real**: Atualização automática do progresso

### 10. 📋 **Inventário**

#### Funcionalidades Principais
- **Controle Detalhado**: Rastreamento específico por localização
- **Status Múltiplos**: Disponível, Reservado, Danificado, Vencido
- **Vida Útil**: Controle individual para equipamentos
- **Movimentação Automática**: Transferência entre estoque e inventário

#### Controle de Vida Útil
- **Itens Individuais**: Quantidade fixa em 1 para equipamentos
- **Histórico Completo**: Eventos, manutenções, reparos
- **Manutenção Preventiva**: Agendamento e alertas
- **Custos**: Controle de gastos com manutenção

#### Status de Inventário
- **Disponível**: Item pronto para uso
- **Reservado**: Item alocado para uso específico
- **Danificado**: Item com problemas identificados
- **Vencido**: Item fora da validade

### 11. 📝 **Pedidos Internos**

#### Funcionalidades Principais
- **Fluxo Completo**: Solicitação → Aprovação → Envio → Entrega
- **Controle de Orçamento**: Validação em tempo real
- **Filtro Inteligente**: Apenas itens disponíveis no CD
- **Priorização**: 4 níveis de prioridade

#### Fluxo de Status
1. **Solicitado**: Pedido criado, aguardando análise
2. **Analisando**: Verificação de disponibilidade no CD
3. **Aprovado**: Pedido aprovado, pronto para envio
4. **Aprovado-Pendente**: Aprovado mas aguardando compra de itens em falta
5. **Preparando**: Separando itens no CD
6. **Enviado**: Itens em rota para a unidade
7. **Recebido**: Itens chegaram na unidade
8. **Aprovado-Unidade**: Confirmação final de recebimento

#### Validações Automáticas
- **Orçamento**: Verificação em tempo real se a unidade tem verba
- **Estoque CD**: Validação de disponibilidade antes do envio
- **Compra Automática**: Criação de pedidos de compra para itens em falta

### 12. 🛒 **Compras**

#### Funcionalidades Principais
- **Exclusivo para CDs**: Apenas Centros de Distribuição fazem compras
- **Gestão de Fornecedores**: Vinculação com fornecedores cadastrados
- **Controle de Status**: Fluxo completo até finalização
- **Finalização Automática**: Adição automática ao estoque

#### Fluxo de Compras
1. **Pedido Realizado**: Compra criada
2. **Em Cotação**: Cotando preços
3. **Comprado-Aguardando**: Aguardando entrega
4. **Chegou CD**: Mercadoria no CD
5. **Enviado**: Distribuído para unidades
6. **Finalizado**: Adicionado ao estoque automaticamente

#### Integração com Pedidos
- **Criação Automática**: Compras geradas quando CD não tem estoque
- **Vinculação**: Compras linkadas aos pedidos que as originaram
- **Status Sincronizado**: Pedidos ficam pendentes até compra ser finalizada

### 13. 💰 **Financeiro**

#### Funcionalidades Principais
- **Orçamentos por Unidade**: Controle individual de verba
- **Receitas e Despesas**: Gestão completa de transações
- **Relatórios Detalhados**: Gastos por unidade e categoria
- **Alertas de Orçamento**: Notificações de vencimento e esgotamento

#### Gestão de Orçamentos
- **Períodos Configuráveis**: Orçamentos com data de início e fim
- **Consumo Automático**: Débito automático quando pedidos são entregues
- **Saldo em Tempo Real**: Cálculo automático do disponível
- **Múltiplos Orçamentos**: Possibilidade de vários orçamentos por unidade

#### Transações Financeiras
- **Receitas**: Adição manual de verbas
- **Despesas**: Criadas automaticamente no consumo de orçamento
- **Rastreabilidade**: Vinculação com pedidos e compras
- **Relatórios**: Análise por período, unidade e categoria

### 14. ↔️ **Movimentações**

#### Funcionalidades Principais
- **Histórico Completo**: Todas as movimentações entre unidades
- **Tipos de Movimento**: Transferência, Ajuste, Compra
- **Criação Manual**: Movimentações diretas entre unidades
- **Registro Automático**: Movimentações geradas pelo sistema

#### Tipos de Movimentação
- **Transferência**: Entre unidades diferentes (apenas CD → Unidade)
- **Ajuste**: Correção de quantidade no estoque
- **Compra**: Criada automaticamente quando compras são finalizadas

#### Validações
- **Estoque Disponível**: Verificação antes de transferências
- **Origem Válida**: Apenas CDs podem ser origem de transferências
- **Rastreabilidade**: Referência ao pedido ou processo que originou

### 15. 📊 **Logs de Auditoria**

#### Funcionalidades Principais
- **Rastreamento Completo**: Todas as ações são registradas
- **Filtros por Período**: Consulta por data específica
- **Detalhamento**: Valores antigos e novos de cada alteração
- **Usuário e Timestamp**: Quem fez o que e quando

#### Tipos de Log
- **Criação**: Novos registros
- **Atualização**: Modificações
- **Exclusão**: Remoções
- **Login/Logout**: Controle de acesso
- **Operações Especiais**: Aprovações, finalizações, etc.

#### Informações Registradas
- Usuário responsável
- Ação realizada
- Tabela afetada
- ID do registro
- Valores antes e depois
- Data/hora da operação

---

## 🔄 Fluxos Principais do Sistema

### 📋 **Fluxo de Pedidos Internos**

```
1. Operador Administrativo cria pedido
   ↓
2. Sistema valida orçamento da unidade
   ↓
3. Gestor/Almoxarife aprova pedido
   ↓
4. Sistema verifica estoque no CD
   ↓
5a. Se tem estoque: Envia para "Em Rota"
5b. Se não tem: Cria compra automática → Status "Aprovado-Pendente"
   ↓
6. Item em trânsito (rastreamento visual)
   ↓
7. Confirmação de entrega
   ↓
8. Adição automática ao estoque da unidade
   ↓
9. Consumo automático do orçamento
   ↓
10. Finalização do pedido
```

### 🛒 **Fluxo de Compras**

```
1. Almoxarife cria pedido de compra
   ↓
2. Sistema valida orçamento do CD
   ↓
3. Cotação com fornecedores
   ↓
4. Compra realizada
   ↓
5. Recebimento no CD
   ↓
6. Finalização da compra
   ↓
7. Adição automática ao estoque do CD
   ↓
8. Liberação de pedidos pendentes
```

### 💰 **Fluxo Financeiro**

```
1. Configuração de orçamento por unidade
   ↓
2. Criação de pedidos (validação de verba)
   ↓
3. Aprovação (sem consumo ainda)
   ↓
4. Entrega dos itens
   ↓
5. Consumo automático do orçamento
   ↓
6. Criação de transação financeira
   ↓
7. Atualização do saldo disponível
```

---

## 🔧 Funcionalidades Técnicas

### 🔒 **Segurança**
- **RLS (Row Level Security)**: Controle de acesso a nível de banco
- **Autenticação**: Sistema robusto com recuperação de senha
- **Auditoria**: Log completo de todas as operações
- **Timeout**: Logout automático para operadores administrativos

### 🤖 **Automações**
- **Triggers de Banco**: Atualizações automáticas de timestamps
- **Consumo de Orçamento**: Débito automático na entrega
- **Finalização de Pedidos**: Status automático quando todos itens entregues
- **Criação de Compras**: Pedidos automáticos quando estoque insuficiente
- **Movimentações**: Registro automático de todas as transferências

### 📱 **Interface**
- **Design Responsivo**: Funciona em desktop, tablet e mobile
- **Animações**: Feedback visual para melhor UX
- **Filtros Inteligentes**: Busca e filtros em tempo real
- **Notificações**: Alertas e confirmações em tempo real
- **Temas**: Design moderno com cores consistentes

### 🔄 **Integrações**
- **Supabase**: Banco de dados PostgreSQL com RLS
- **Edge Functions**: Processamento serverless para operações complexas
- **Real-time**: Atualizações em tempo real via WebSockets
- **Email**: Sistema de recuperação de senha e notificações

---

## 📈 Relatórios e Analytics

### 📊 **Relatórios Disponíveis**
- **Gastos por Unidade**: Consumo de orçamento detalhado
- **Estoque Baixo**: Itens que precisam reposição
- **Movimentações**: Histórico de transferências
- **Manutenções**: Equipamentos que precisam manutenção
- **Auditoria**: Relatório completo de ações

### 📉 **Métricas em Tempo Real**
- Status de estoque por unidade
- Orçamentos disponíveis
- Pedidos pendentes por status
- Itens em trânsito
- Alertas de sistema

---

## 🚀 Tecnologias Utilizadas

### **Frontend**
- **React 18** com TypeScript
- **Tailwind CSS** para estilização
- **React Router** para navegação
- **React Hook Form** para formulários
- **Lucide React** para ícones
- **React Hot Toast** para notificações

### **Backend**
- **Supabase** (PostgreSQL + Auth + Real-time)
- **Row Level Security (RLS)** para controle de acesso
- **Edge Functions** para lógica serverless
- **Triggers** para automações de banco

### **Infraestrutura**
- **Vite** como bundler
- **TypeScript** para type safety
- **ESLint** para qualidade de código
- **PostCSS** para processamento CSS

---

## 🎯 Casos de Uso Principais

### 🏥 **Clínica Odontológica**
- Controle de materiais odontológicos
- Gestão de equipamentos com manutenção
- Pedidos entre consultórios
- Controle de estoque de medicamentos

### 🏢 **Empresa Multi-Filial**
- Distribuição centralizada de materiais
- Controle de orçamento por filial
- Pedidos internos automatizados
- Relatórios gerenciais

### 🏭 **Indústria**
- Controle de insumos de produção
- Gestão de ferramentas e equipamentos
- Manutenção preventiva
- Movimentações entre setores

---

## 📋 Próximas Funcionalidades

### 🔮 **Roadmap**
- [ ] **Dashboard Analytics**: Gráficos avançados e KPIs
- [ ] **Integração com ERP**: Conectores para sistemas externos
- [ ] **App Mobile**: Aplicativo nativo para operações de campo
- [ ] **Código de Barras**: Leitura e impressão de etiquetas
- [ ] **Relatórios PDF**: Exportação de relatórios
- [ ] **Notificações Push**: Alertas em tempo real
- [ ] **API Pública**: Integração com sistemas terceiros
- [ ] **Backup Automático**: Rotinas de backup e restore

---

## 🛠️ Instalação e Configuração

### **Pré-requisitos**
- Node.js 18+
- Conta no Supabase
- Git

### **Configuração**
1. Clone o repositório
2. Instale dependências: `npm install`
3. Configure variáveis de ambiente (`.env`)
4. Execute migrações do Supabase
5. Inicie o servidor: `npm run dev`

### **Variáveis de Ambiente**
```env
VITE_SUPABASE_URL=sua_url_do_supabase
VITE_SUPABASE_ANON_KEY=sua_chave_anonima
```

---

## 📞 Suporte

Para dúvidas, sugestões ou problemas:
- **Documentação**: Este README
- **Logs**: Módulo de Auditoria no sistema
- **Suporte Técnico**: Contate o administrador do sistema

---

**SupplyArt** - Transformando a gestão de estoque em uma experiência inteligente e automatizada! 🚀