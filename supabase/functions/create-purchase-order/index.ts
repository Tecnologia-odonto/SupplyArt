import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        }
      }
    )

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      throw new Error('Authorization header missing')
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabaseClient.auth.getUser(token)
    
    if (authError || !user) {
      throw new Error('Unauthorized')
    }

    const requestData = await req.json()
    const { unit_id, budget_id, notes, items } = requestData

    console.log('Creating purchase order:', { user_id: user.id, unit_id, budget_id })

    // Validar campos obrigatórios
    if (!unit_id) {
      throw new Error('unit_id é obrigatório')
    }

    // Buscar perfil do usuário
    const { data: profile, error: profileError } = await supabaseClient
      .from('profiles')
      .select('role, unit_id')
      .eq('id', user.id)
      .maybeSingle()

    if (profileError || !profile) {
      throw new Error('Perfil do usuário não encontrado')
    }

    // Verificar permissão: Op. Administrativo só pode criar para sua unidade
    if (profile.role === 'operador-administrativo' && profile.unit_id !== unit_id) {
      throw new Error('Você só pode criar pedidos para sua unidade')
    }

    let total_value = 0
    let budget_data = null

    // Se budget_id foi fornecido, verificar orçamento e herdar valor
    if (budget_id) {
      const { data: budget, error: budgetError } = await supabaseClient
        .from('unit_budgets')
        .select('*')
        .eq('id', budget_id)
        .eq('unit_id', unit_id)
        .maybeSingle()

      if (budgetError) {
        console.error('Erro ao buscar orçamento:', budgetError)
        throw new Error('Erro ao buscar orçamento')
      }

      if (!budget) {
        throw new Error('Orçamento não encontrado')
      }

      budget_data = budget
      
      // Herdar o valor do orçamento aprovado
      // Assumindo que existe um campo valor_total_aprovado ou budget_amount
      total_value = budget.budget_amount || 0

      // Verificar se há saldo disponível
      const available = budget.available_amount || 0
      
      if (total_value > available) {
        console.log('Orçamento excedido:', { total_value, available, budget })
        
        // Buscar gestores da unidade para notificar
        const { data: gestors, error: gestorsError } = await supabaseClient
          .from('profiles')
          .select('id, name')
          .eq('unit_id', unit_id)
          .eq('role', 'gestor')

        if (!gestorsError && gestors && gestors.length > 0) {
          // Criar notificações para cada gestor
          const notifications = gestors.map(gestor => ({
            user_id: gestor.id,
            title: 'Orçamento Excedido',
            message: `O usuário ${profile.role} (ID: ${user.id}) tentou criar um pedido que excede o orçamento disponível. Valor tentado: R$ ${total_value.toFixed(2)}, Saldo disponível: R$ ${available.toFixed(2)}.`,
            type: 'warning',
            metadata: {
              user_id: user.id,
              unit_id: unit_id,
              attempted_amount: total_value,
              available_amount: available,
              timestamp: new Date().toISOString()
            }
          }))

          await supabaseClient
            .from('notifications')
            .insert(notifications)
        }

        throw new Error('Erro ao criar o pedido de compra')
      }
    } else if (items && items.length > 0) {
      // Se não há budget_id, calcular total dos itens
      total_value = items.reduce((sum: number, item: any) => {
        return sum + (item.quantity * (item.unit_price || 0))
      }, 0)

      // Verificar orçamento disponível da unidade no período atual
      const { data: currentBudget, error: currentBudgetError } = await supabaseClient
        .from('unit_budgets')
        .select('*')
        .eq('unit_id', unit_id)
        .lte('period_start', new Date().toISOString().split('T')[0])
        .gte('period_end', new Date().toISOString().split('T')[0])
        .maybeSingle()

      if (currentBudget) {
        const available = currentBudget.available_amount || 0
        
        if (total_value > available) {
          console.log('Orçamento excedido:', { total_value, available })
          
          // Buscar gestores da unidade para notificar
          const { data: gestors, error: gestorsError } = await supabaseClient
            .from('profiles')
            .select('id, name')
            .eq('unit_id', unit_id)
            .eq('role', 'gestor')

          if (!gestorsError && gestors && gestors.length > 0) {
            const notifications = gestors.map(gestor => ({
              user_id: gestor.id,
              title: 'Orçamento Excedido',
              message: `O usuário ${profile.role} (ID: ${user.id}) tentou criar um pedido que excede o orçamento disponível. Valor tentado: R$ ${total_value.toFixed(2)}, Saldo disponível: R$ ${available.toFixed(2)}.`,
              type: 'warning',
              metadata: {
                user_id: user.id,
                unit_id: unit_id,
                attempted_amount: total_value,
                available_amount: available,
                timestamp: new Date().toISOString()
              }
            }))

            await supabaseClient
              .from('notifications')
              .insert(notifications)
          }

          throw new Error('Erro ao criar o pedido de compra')
        }
      }
    }

    // Criar o pedido com transação (usar RPC se necessário para atomicidade)
    const purchaseData = {
      unit_id,
      requester_id: user.id,
      status: 'pedido-realizado',
      budget_id: budget_id || null,
      total_value,
      notes: notes || null
    }

    const { data: purchase, error: purchaseError } = await supabaseClient
      .from('purchases')
      .insert(purchaseData)
      .select()
      .single()

    if (purchaseError) {
      console.error('Erro ao criar pedido:', purchaseError)
      throw new Error(`Erro ao criar pedido: ${purchaseError.message}`)
    }

    console.log('Pedido criado com sucesso:', purchase.id)

    // Se houver itens, criar purchase_items
    if (items && items.length > 0) {
      const purchaseItems = items.map((item: any) => ({
        purchase_id: purchase.id,
        item_id: item.item_id,
        quantity: item.quantity,
        unit_price: item.unit_price || null,
        total_price: item.quantity * (item.unit_price || 0)
      }))

      const { error: itemsError } = await supabaseClient
        .from('purchase_items')
        .insert(purchaseItems)

      if (itemsError) {
        console.error('Erro ao criar itens do pedido:', itemsError)
        // Rollback: deletar o pedido criado
        await supabaseClient
          .from('purchases')
          .delete()
          .eq('id', purchase.id)
        
        throw new Error('Erro ao criar itens do pedido')
      }
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        purchase,
        message: 'Pedido criado com sucesso'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200,
      },
    )

  } catch (error) {
    console.error('Erro na função create-purchase-order:', error)
    return new Response(
      JSON.stringify({ 
        error: error.message || 'Erro inesperado ao criar pedido'
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400,
      },
    )
  }
})
