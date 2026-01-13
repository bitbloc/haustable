
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
    const body = await req.json()
    const { action } = body

    // 0. Register Account (Email/Password) - Auto Confirm
    if (action === 'register_account') {
        const { email, password, profileData } = body
        if (!email || !password || !profileData) throw new Error("Missing Parameters")

        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        // 1. Create User (Auto Confirm)
        const { data: userData, error: createError } = await adminClient.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Bypass Email Verification
            user_metadata: { full_name: profileData.display_name }
        })

        if (createError) throw createError
        if (!userData.user) throw new Error("Failed to create user object")

        const userId = userData.user.id

        // 2. Upsert Profile
        const { error: upsertError } = await adminClient.from('profiles').upsert({
            id: userId,
            display_name: profileData.display_name,
            nickname: profileData.nickname,
            phone_number: profileData.phone_number,
            birth_day: profileData.birth_day,
            birth_month: profileData.birth_month,
            gender: profileData.gender,
            line_user_id: profileData.line_user_id || null, 
            role: 'customer'
        })

        if (upsertError) {
            // Rollback? Hard to delete user, but let's try or just throw
             await adminClient.auth.admin.deleteUser(userId)
             throw upsertError
        }

        return new Response(JSON.stringify({ success: true, userId }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    // 0.1 Special Logic for Email Registration... (Legacy/Manual)
    if (action === 'register_email_profile') {
        const adminClient = createClient(
            Deno.env.get('SUPABASE_URL') ?? '',
            Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
        )

        const { userId, profileData } = body
        if (!userId || !profileData) throw new Error("Missing Parameters")

        // Check for duplicate phone number
        if (profileData.phone_number) {
            const { data: conflict } = await adminClient
                .from('profiles')
                .select('id')
                .eq('phone_number', profileData.phone_number)
                .neq('id', userId) 
                .maybeSingle()
            
            if (conflict) {
                throw new Error(`Phone number ${profileData.phone_number} is already registered.`)
            }
        }

        // Use Admin Client to Bypass RLS
        const { error: upsertError } = await adminClient.from('profiles').upsert({
            id: userId,
            display_name: profileData.display_name,
            nickname: profileData.nickname,
            phone_number: profileData.phone_number,
            birth_day: profileData.birth_day,
            birth_month: profileData.birth_month,
            gender: profileData.gender,
            line_user_id: profileData.line_user_id || null, 
            role: 'customer'
        })

        if (upsertError) throw upsertError

        return new Response(JSON.stringify({ success: true }), { 
            headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        })
    }

    // --- LINE RELATED ACTIONS BELOW ---
    const { idToken, profileData, bookingData } = body
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

    // Helper to generate session link
    const generateSessionLink = async (lineUserId: string) => {
        const email = `line_${lineUserId}@haus.local`
        const { data, error } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: email
        })
        if (error) {
             console.error("Generate Link Error:", error)
             return null
        }
        return data.properties.action_link
    }

    if (action === 'check_user') {
        const { data } = await supabaseAdmin
            .from('profiles')
            .select('*') // Select all to get name for repair if needed
            .eq('line_user_id', lineUserId)
            .single()
        
        let sessionLink = null
        if (data) {
             sessionLink = await generateSessionLink(lineUserId)
             
             // Repair: If profile exists but no link (likely no Auth User), create Auth User
             if (!sessionLink) {
                 console.log("Profile exists but no Auth User. repairing...")
                 const email = `line_${lineUserId}@haus.local`
                 const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                    email: email,
                    email_confirm: true,
                    user_metadata: { full_name: data.display_name || lineDisplayName, line_user_id: lineUserId }
                })
                
                if (!createError && newUser) {
                    // Try generate link again
                    sessionLink = await generateSessionLink(lineUserId)
                } else {
                    console.error("Failed to repair user:", createError)
                }
             }
        }

        result = { 
            status: data ? 'existing_user' : 'new_user', 
            profile: data ? { ...data, userId: lineUserId, pictureUrl: linePicture } : { userId: lineUserId, displayName: lineDisplayName, pictureUrl: linePicture },
            sessionLink // Might still be null if repair failed
        }
    }

    else if (action === 'register_profile') {
        // ... (existing user finding logic) ...
        // We need to simplify the logic to ensure we always have a user and then generate link.
        
        // Let's try to find existing user first, if not create one.
        let { data: existingUser } = await supabaseAdmin.from('profiles').select('id').eq('line_user_id', lineUserId).single()
        let targetUuid = existingUser?.id
        let sessionLink = null

        if (!targetUuid) {
            // 1. Try Create
            const email = `line_${lineUserId}@haus.local`
            const { data: newUser, error: createError } = await supabaseAdmin.auth.admin.createUser({
                email: email,
                email_confirm: true,
                user_metadata: { full_name: profileData.display_name, line_user_id: lineUserId }
            })
            
            if (newUser?.user) {
                targetUuid = newUser.user.id
            } else {
                 console.log("Create user failed (likely exists). Trying to recover via Link Generation...", createError)
                 // 2. Fallback: Generate Link to get User ID
                 const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
                    type: 'magiclink',
                    email: email
                })
                
                if (linkData?.user) {
                    targetUuid = linkData.user.id
                    sessionLink = linkData.properties.action_link
                } else {
                    console.error("Link Gen failed:", linkError)
                }
            }
        }
        
        if (!targetUuid) throw new Error("Could not resolve User User ID (System Error)")

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
            role: 'customer'
        })
        if (upsertError) throw upsertError

        // Ensure we have a link
        if (!sessionLink) {
             sessionLink = await generateSessionLink(lineUserId)
        }
        
        if (!sessionLink) {
            throw new Error("Unable to allow login (Rate Limit?). Please try again in a few minutes.")
        }

        result = { success: true, userId: targetUuid, sessionLink }
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
    
    // NOTE: 'register_email_profile' is handled above early.
    
    else {
        throw new Error("Invalid Action")
    }

    return new Response(JSON.stringify(result), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
    })

  } catch (err) {
    console.error("Manage Booking Error:", err.message)
    // Return 200 OK but with success: false and error message
    // This allows the client to read the error body without parsing 400 exceptions
    return new Response(JSON.stringify({ success: false, error: err.message }), { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200 
    })
  }
})
