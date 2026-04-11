import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-api-key',
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  const apiKey = req.headers.get('x-internal-api-key')
  const systemApiKey = Deno.env.get('STOCK_API_KEY')

  // 1. Basic Security Check
  if (!apiKey || apiKey !== systemApiKey) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      status: 401
    })
  }

  const supabaseAdmin = createClient(
    Deno.env.get('SUPABASE_URL') ?? '',
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
  )

  const url = new URL(req.url)
  const pathParts = url.pathname.split('/').filter(Boolean)
  // Expected path format: /stock-api/resource[/id]
  // In Supabase, the function name is 'stock-api', so pathname starts with /stock-api
  const resource = pathParts[1] 
  const idValue = pathParts[2]

  try {
    // --- Endpoints for STOCK ITEMS ---
    if (resource === 'items') {
      // GET /items
      if (req.method === 'GET') {
        if (idValue) {
          const { data, error } = await supabaseAdmin
            .from('stock_items')
            .select('*')
            .eq('id', idValue)
            .single()
          if (error) throw error
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        } else {
          const search = url.searchParams.get('search')
          const category = url.searchParams.get('category')
          let query = supabaseAdmin.from('stock_items').select('*').order('display_order', { ascending: true })
          
          if (category) query = query.eq('category', category)
          if (search) query = query.or(`name.ilike.%${search}%,barcode.eq.${search}`)

          const { data, error } = await query
          if (error) throw error
          return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
        }
      }

      // POST /items (Create)
      if (req.method === 'POST') {
        const body = await req.json()
        const { data, error } = await supabaseAdmin.from('stock_items').insert(body).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
      }

      // PUT /items/:id (Update)
      if (req.method === 'PUT' && idValue) {
        const body = await req.json()
        const { data, error } = await supabaseAdmin.from('stock_items').update(body).eq('id', idValue).select().single()
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }

      // DELETE /items/:id
      if (req.method === 'DELETE' && idValue) {
        const { error } = await supabaseAdmin.from('stock_items').delete().eq('id', idValue)
        if (error) throw error
        return new Response(JSON.stringify({ success: true }), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // --- Endpoints for TRANSACTIONS ---
    if (resource === 'transactions') {
      // POST /transactions
      if (req.method === 'POST') {
        const body = await req.json()
        // body should have { stock_item_id, transaction_type, quantity_change, performed_by, note }
        const { data, error } = await supabaseAdmin.from('stock_transactions').insert(body).select().single()
        if (error) throw error
        
        // Note: The database trigger (trg_stock_transaction_sync) will handle updating stock_items.current_quantity
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
      }

      // GET /transactions (History)
      if (req.method === 'GET') {
        const itemId = url.searchParams.get('item_id')
        let query = supabaseAdmin.from('stock_transactions').select(`*, stock_items(name)`).order('created_at', { ascending: false }).limit(100)
        if (itemId) query = query.eq('stock_item_id', itemId)
        
        const { data, error } = await query
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // --- Endpoints for LOW STOCK ---
    if (resource === 'low-stock') {
      if (req.method === 'GET') {
        // Find items where current_quantity <= reorder_point
        const { data, error } = await supabaseAdmin
          .from('stock_items')
          .select('*')
          .filter('current_quantity', 'lte', 'reorder_point') // This syntax might vary depending on postgrest version, usually 'lte' works
          .order('category', { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    // --- Endpoints for CATEGORIES ---
    if (resource === 'categories') {
      if (req.method === 'GET') {
        const { data, error } = await supabaseAdmin.from('stock_categories').select('*').order('sort_order', { ascending: true })
        if (error) throw error
        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' } })
      }
    }

    return new Response(JSON.stringify({ error: 'Endpoint Not Found' }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 404 
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400 
    })
  }
})
