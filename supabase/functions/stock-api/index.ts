import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-internal-api-key',
}

function getUnitType(unit?: string): string {
  const normalized = unit?.toLowerCase().trim();
  if (!normalized) return 'unknown';

  const massKeys = ['kg', 'g', 'mg', 'ขีด', 'lb', 'oz'];
  const volumeKeys = ['l', 'ml', 'gallon', 'oz_fl', 'cup', 'tbsp', 'tsp', 'shot'];
  const countKeys = ['unit', 'pcs', 'box', 'pack', 'can', 'bottle', 'bag', 'crate', 'carton', 'glass'];

  if (massKeys.includes(normalized)) return 'mass';
  if (volumeKeys.includes(normalized)) return 'volume';
  if (countKeys.includes(normalized)) return 'count';

  return 'unknown';
}

function areUnitTypesCompatible(unitA?: string, unitB?: string): boolean {
  const typeA = getUnitType(unitA);
  const typeB = getUnitType(unitB);
  if (typeA === 'unknown' || typeB === 'unknown') return false;
  return typeA === typeB;
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
        
        // Data validation
        if (body.cost_price !== undefined && parseFloat(body.cost_price) < 0) {
          throw new Error('ราคาต้นทุนต้องไม่ต่ำกว่า 0 บาท')
        }
        if (body.pack_size !== undefined && parseFloat(body.pack_size) <= 0) {
          throw new Error('ปริมาณขนาดบรรจุภัณฑ์ (Pack Size) ต้องมากกว่า 0')
        }
        if (body.conversion_factor !== undefined && parseFloat(body.conversion_factor) <= 0) {
          throw new Error('ตัวแปลงหน่วยต้องมีค่ามากกว่า 0')
        }
        if (body.yield_percent !== undefined && (parseFloat(body.yield_percent) < 1 || parseFloat(body.yield_percent) > 100)) {
          throw new Error('Yield % ต้องอยู่ระหว่าง 1 ถึง 100%')
        }
        if (body.min_stock_threshold !== undefined && parseFloat(body.min_stock_threshold) < 0) {
          throw new Error('ระดับแจ้งเตือนขั้นต่ำต้องไม่ต่ำกว่า 0')
        }
        if (body.reorder_point !== undefined && parseFloat(body.reorder_point) < 0) {
          throw new Error('จุดสั่งซื้อต้องไม่ต่ำกว่า 0')
        }
        if (body.par_level !== undefined && parseFloat(body.par_level) < 0) {
          throw new Error('เป้าหมายระดับสต็อกต้องไม่ต่ำกว่า 0')
        }

        // Unit type compatibility validation
        const packUnit = body.pack_unit
        const usageUnit = body.usage_unit
        if (packUnit && usageUnit) {
          const isCompatible = areUnitTypesCompatible(packUnit, usageUnit)
          const conversionFactorVal = parseFloat(body.conversion_factor)
          if (!isCompatible) {
            if (body.conversion_factor === undefined || body.conversion_factor === null || isNaN(conversionFactorVal) || conversionFactorVal <= 0) {
              throw new Error('กรุณาระบุตัวแปลงหน่วยสำหรับการแปลงหน่วยข้ามประเภท (ต้องมากกว่า 0)')
            }
          } else {
            if (body.conversion_factor !== undefined && (isNaN(conversionFactorVal) || conversionFactorVal <= 0)) {
              throw new Error('ตัวแปลงหน่วยต้องมีค่ามากกว่า 0')
            }
          }
        }

        const initialQty = parseFloat(body.current_quantity) || 0
        // Force current_quantity to 0 for initial insert
        body.current_quantity = 0

        const { data, error } = await supabaseAdmin.from('stock_items').insert(body).select().single()
        if (error) throw error

        // If initialQty > 0, insert a stock transaction
        if (initialQty > 0 && data) {
          const { error: txError } = await supabaseAdmin.from('stock_transactions').insert({
            stock_item_id: data.id,
            transaction_type: 'audit',
            quantity_change: initialQty,
            performed_by: 'System (Initial Stock via API)',
            note: 'จำนวนสต็อกเริ่มต้นเมื่อสร้างสินค้าวัตถุดิบผ่าน API'
          })
          if (txError) {
            console.error("Initial transaction insert failed:", txError)
          }
        }

        return new Response(JSON.stringify(data), { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 201 })
      }

      // PUT /items/:id (Update)
      if (req.method === 'PUT' && idValue) {
        const body = await req.json()

        // Data validation
        if (body.cost_price !== undefined && parseFloat(body.cost_price) < 0) {
          throw new Error('ราคาต้นทุนต้องไม่ต่ำกว่า 0 บาท')
        }
        if (body.pack_size !== undefined && parseFloat(body.pack_size) <= 0) {
          throw new Error('ปริมาณขนาดบรรจุภัณฑ์ (Pack Size) ต้องมากกว่า 0')
        }
        if (body.conversion_factor !== undefined && parseFloat(body.conversion_factor) <= 0) {
          throw new Error('ตัวแปลงหน่วยต้องมีค่ามากกว่า 0')
        }
        if (body.yield_percent !== undefined && (parseFloat(body.yield_percent) < 1 || parseFloat(body.yield_percent) > 100)) {
          throw new Error('Yield % ต้องอยู่ระหว่าง 1 ถึง 100%')
        }
        if (body.min_stock_threshold !== undefined && parseFloat(body.min_stock_threshold) < 0) {
          throw new Error('ระดับแจ้งเตือนขั้นต่ำต้องไม่ต่ำกว่า 0')
        }
        if (body.reorder_point !== undefined && parseFloat(body.reorder_point) < 0) {
          throw new Error('จุดสั่งซื้อต้องไม่ต่ำกว่า 0')
        }
        if (body.par_level !== undefined && parseFloat(body.par_level) < 0) {
          throw new Error('เป้าหมายระดับสต็อกต้องไม่ต่ำกว่า 0')
        }

        // Fetch existing item to check compatibility correctly
        const { data: existingItem, error: fetchError } = await supabaseAdmin
          .from('stock_items')
          .select('pack_unit, usage_unit, conversion_factor')
          .eq('id', idValue)
          .single()

        if (fetchError || !existingItem) {
          throw new Error('ไม่พบข้อมูลสินค้าวัตถุดิบที่ต้องการแก้ไข')
        }

        const packUnit = body.pack_unit !== undefined ? body.pack_unit : existingItem.pack_unit
        const usageUnit = body.usage_unit !== undefined ? body.usage_unit : existingItem.usage_unit
        const conversionFactor = body.conversion_factor !== undefined ? body.conversion_factor : existingItem.conversion_factor

        if (packUnit && usageUnit) {
          const isCompatible = areUnitTypesCompatible(packUnit, usageUnit)
          const conversionFactorVal = parseFloat(conversionFactor)
          if (!isCompatible) {
            if (conversionFactor === undefined || conversionFactor === null || isNaN(conversionFactorVal) || conversionFactorVal <= 0) {
              throw new Error('กรุณาระบุตัวแปลงหน่วยสำหรับการแปลงหน่วยข้ามประเภท (ต้องมากกว่า 0)')
            }
          } else {
            if (conversionFactor !== undefined && (isNaN(conversionFactorVal) || conversionFactorVal <= 0)) {
              throw new Error('ตัวแปลงหน่วยต้องมีค่ามากกว่า 0')
            }
          }
        }

        // Prevent updating current_quantity directly through updates
        delete body.current_quantity

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
