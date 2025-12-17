
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LINE_CHANNEL_ID = '2008674756' // Extracted from LIFF ID

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { action, idToken, profileData, bookingData } = await req.json()

    if (!idToken) throw new Error('Missing idToken')

    // 1. Verify ID Token with LINE
    // POST https://api.line.me/oauth2/v2.1/verify
    const params = new URLSearchParams()
    params.append('id_token', idToken)
    params.append('client_id', LINE_CHANNEL_ID)

    const verifyResp = await fetch('https://api.line.me/oauth2/v2.1/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params
    })

    const verifyResult = await verifyResp.json()

    if (!verifyResp.ok || verifyResult.error) {
        throw new Error(`LINE Token Verification Failed: ${verifyResult.error_description || 'Unknown Error'}`)
    }

    const lineUserId = verifyResult.sub // Trusted User ID
    const lineDisplayName = verifyResult.name
    const linePicture = verifyResult.picture

    // 2. Setup Admin Client (Service Role)
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    // 3. Handle Actions
    let result = {}

    if (action === 'check_user') {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('id')
            .eq('line_user_id', lineUserId)
            .single()
        
        result = { status: data ? 'existing_user' : 'new_user', profile: { userId: lineUserId, displayName: lineDisplayName, pictureUrl: linePicture } }
    }

    else if (action === 'register_profile') {
        // Upsert Profile
        // Note: For 'id', we might not have a UUID if they aren't in auth.users. 
        // Strategy: Use lineUserId as ID? Or generate a UUID?
        // Issue: 'profiles.id' usually references 'auth.users.id'. 
        // If we want Hybrid, we might need to store them in 'profiles' but what about the FK?
        // OPTION: If 'auth.users' is strictly for Supabase Auth, we can't insert there easily without creating a dummy user.
        // ALTERNATIVE: 'profiles.id' is just a UUID. We can just generate one.
        // Let's check schema. If 'id' is FK to auth.users, we have a problem.
        // ASSUMPTION: 'profiles' table has 'id' as PK, usually references auth.users.
        // FIX: If we can't create an auth user, we can try to create a "Ghost" user or just use a generated UUID if the FK constraint allows (or is not 'strict' / enforced by Auth).
        // If FK is enforced, we MUST create a Supabase Auth user. We can do `supabaseAdmin.auth.admin.createUser()`.
        
        // Let's try to find existing user first, if not create one.
        let { data: existingUser } = await supabaseAdmin.from('profiles').select('id').eq('line_user_id', lineUserId).single()
        
        let targetUuid = existingUser?.id

        if (!targetUuid) {
            // Create a "Dummy" Auth User for this LINE user so they exist in system properly
            // Email: line_{lineUserId}@placeholder.com
            const email = `line_${lineUserId}@haus.local`
            
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                email_confirm: true,
                user_metadata: { full_name: profileData.display_name, line_user_id: lineUserId }
            })
            
            if (createError) {
                // If email exists (maybe they registered but profile missing?), try to get it
                 console.log("Create user error (might exist):", createError)
                 // Just continue, maybe we can find them?
            }
            targetUuid = newUser?.user?.id
        }
        
        if (!targetUuid) throw new Error("Could not generate User ID")

        // Now upsert profile
        const { error: upsertError } = await supabaseAdmin.from('profiles').upsert({
            id: targetUuid,
            line_user_id: lineUserId,
            display_name: profileData.display_name,
            phone_number: profileData.phone_number,
            birth_day: profileData.birth_day,
            birth_month: profileData.birth_month,
            gender: profileData.gender,
            nickname: profileData.nickname,
            role: 'customer' // Default
        })

        if (upsertError) throw upsertError
        result = { success: true, userId: targetUuid }
    }

    else if (action === 'create_booking') {
        // Need to find the internal UUID first
         const { data: profile } = await supabaseAdmin.from('profiles').select('id').eq('line_user_id', lineUserId).single()
         if (!profile) throw new Error("Profile not found. Please register first.")
         
         const payload = { ...bookingData, user_id: profile.id }
         
         // Insert Booking
         const { data: booking, error: bookingError } = await supabaseAdmin
            .from('bookings')
            .insert(payload)
            .select()
            .single()
            
         if (bookingError) throw bookingError
         
         // Insert Order Items if any
         if (bookingData.orderItems && bookingData.orderItems.length > 0) {
             const items = bookingData.orderItems.map(item => ({
                 booking_id: booking.id,
                 ...item
             }))
             const { error: itemsError } = await supabaseAdmin.from('order_items').insert(items)
             if (itemsError) throw itemsError // Warning: Transaction rollback? Supabase API doesn't support complex transactions easily here.
         }
         
         result = { success: true, booking }
    }
    
    else {
        throw new Error("Invalid Action")
    }

    return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error("Manage Booking Error:", err.message)
    return new Response(JSON.stringify({ error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
    })
  }
})
