#!/usr/bin/env node
/**
 * verify-rls.mjs — proof for Phase A of docs/security-hardening-plan.md (section 7).
 *
 * Runs ONLY against a local Supabase stack (refuses any URL whose host is not 127.0.0.1 or
 * localhost). Seeds its own fixtures with the service role, checks what anon, a signed-in
 * customer and a signed-in admin can and cannot do, prints one line per check, removes its
 * fixtures and exits non-zero if any check failed.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 \
 *   SUPABASE_ANON_KEY=<anon key from `supabase status`> \
 *   SUPABASE_SERVICE_ROLE_KEY=<service_role key from `supabase status`> \
 *   node scripts/verify-rls.mjs
 *
 * Local database (the repository's migrations cannot rebuild the schema from zero, so the
 * stack is started from an EMPTY work directory, outside the repo, with no migrations).
 * Commands used on 2026-11-17 (Windows, Git Bash; $W is a scratch directory):
 *
 *   npx supabase db dump --linked --schema public -f "$W/prod_public_schema.sql"   # schema only, no data
 *   npx supabase init --workdir "$W/local"
 *   # (the first dump attempt failed once with "EAUTHQUERY unsupported or invalid secret
 *   #  format" from the pooler right after the CLI created its login role; a retry worked)
 *   npx supabase start --workdir "$W/local" \
 *       -x studio,imgproxy,mailpit,realtime,storage-api,edge-runtime,logflare,vector,supavisor,postgres-meta
 *   # load the dump (the local db container is supabase_db_local); it loaded with no error:
 *   docker exec -i supabase_db_local psql -v ON_ERROR_STOP=1 -U postgres -d postgres < "$W/prod_public_schema.sql"
 *   # one fix-up: production has pg_net (the telegram triggers call net.http_post), the dump
 *   # does not create extensions, so:
 *   docker exec supabase_db_local psql -v ON_ERROR_STOP=1 -U postgres -c "create extension if not exists pg_net"
 *   docker exec -i supabase_db_local psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
 *       < supabase/migrations/20261117120000_lock_backoffice_only_writes.sql
 *   docker exec -i supabase_db_local psql -v ON_ERROR_STOP=1 -U postgres -d postgres \
 *       < supabase/migrations/20261117130000_staff_pin_hashing.sql
 *   docker exec supabase_db_local psql -U postgres -c "NOTIFY pgrst, 'reload schema'"
 *   npx supabase status --workdir "$W/local"            # API URL, anon key, service_role key
 *   node scripts/verify-rls.mjs                          # with the three variables above
 *   npx supabase stop --workdir "$W/local" --no-backup
 */

import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.SUPABASE_URL || ''
const ANON = process.env.SUPABASE_ANON_KEY || ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY || ''

let host = ''
try { host = new URL(URL_).hostname } catch { /* checked below */ }
if (host !== '127.0.0.1' && host !== 'localhost') {
    console.error(`Refusing to run: SUPABASE_URL host must be 127.0.0.1 or localhost (got "${host || URL_ || 'nothing'}").`)
    process.exit(2)
}
if (!ANON || !SERVICE) {
    console.error('Refusing to run: SUPABASE_ANON_KEY and SUPABASE_SERVICE_ROLE_KEY are required.')
    process.exit(2)
}

const opts = { auth: { persistSession: false, autoRefreshToken: false } }
const service = createClient(URL_, SERVICE, opts)
const anon = createClient(URL_, ANON, opts)

const TAG = `verify-rls-${Date.now()}`
const STAFF_PIN = '4826'
const PASSWORD = `pw-${TAG}-Aa1!`

let failures = 0
const line = (status, label, detail = '') =>
    console.log(`${status.padEnd(15)} ${label}${detail ? `  (${detail})` : ''}`)
const pass = (label, detail) => line('PASS', label, detail)
const fail = (label, detail) => { failures++; line('FAIL', label, detail) }
const check = (ok, label, detail) => (ok ? pass(label, detail) : fail(label, detail))
const open = (reachable, label, detail) => line(reachable ? 'OPEN (Phase B)' : 'closed?', label, detail)
const errText = (e) => (e ? `${e.code || ''} ${e.message || ''}`.trim() : 'no error')

async function must(promise, what) {
    const { data, error } = await promise
    if (error) throw new Error(`fixture ${what}: ${errText(error)}`)
    return data
}

// ---------------------------------------------------------------------------------
// Checks shaped like "RLS must stop this": zero rows affected AND the row still there
// (looked up with the service role), not merely the absence of an error.
// ---------------------------------------------------------------------------------
async function rowExists(table, col, val) {
    const { data, error } = await service.from(table).select(col).eq(col, val)
    if (error) throw new Error(`service lookup ${table}: ${errText(error)}`)
    return data.length > 0
}

async function expectDeleteBlocked(client, who, table, col, val) {
    const { data, error } = await client.from(table).delete().eq(col, val).select(col)
    const affected = data ? data.length : 0
    const still = await rowExists(table, col, val)
    check(affected === 0 && still, `${who} cannot delete ${table}`, `${affected} rows deleted, row ${still ? 'still there' : 'GONE'}, ${errText(error)}`)
}

async function expectUpdateBlocked(client, who, table, col, val, patch, field) {
    const before = await must(service.from(table).select(field).eq(col, val).single(), `${table} before`)
    const { data, error } = await client.from(table).update(patch).eq(col, val).select(col)
    const affected = data ? data.length : 0
    const after = await must(service.from(table).select(field).eq(col, val).single(), `${table} after`)
    const unchanged = JSON.stringify(before[field]) === JSON.stringify(after[field])
    check(affected === 0 && unchanged, `${who} cannot update ${table}`, `${affected} rows updated, value ${unchanged ? 'unchanged' : 'CHANGED'}, ${errText(error)}`)
}

async function expectInsertBlocked(client, who, table, row, col, val) {
    const { data, error } = await client.from(table).insert(row).select(col)
    const inserted = data ? data.length : 0
    const exists = await rowExists(table, col, val)
    if (exists) await service.from(table).delete().eq(col, val)
    check(inserted === 0 && !exists && !!error, `${who} cannot insert ${table}`, errText(error))
}

async function expectReadEmpty(client, who, table, col, val) {
    const { data, error } = await client.from(table).select(col).eq(col, val)
    const n = data ? data.length : 0
    check(n === 0, `${who} cannot read ${table}`, `${n} rows visible, ${errText(error)}`)
}

async function expectRpcRefused(client, who, fn, args) {
    const { error } = await client.rpc(fn, args)
    check(!!error, `${who} cannot call ${fn}`, errText(error))
}

// ---------------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------------
const ids = { users: [] }

async function makeUser(label, role, extra = {}) {
    const email = `${label}.${TAG}@example.test`
    const { data, error } = await service.auth.admin.createUser({ email, password: PASSWORD, email_confirm: true })
    if (error) throw new Error(`createUser ${label}: ${errText(error)}`)
    const id = data.user.id
    ids.users.push(id)
    await must(service.from('profiles').upsert({ id, display_name: `${label} ${TAG}`, role, ...extra }), `profile ${label}`)
    return { id, email }
}

async function signIn(email) {
    const client = createClient(URL_, ANON, opts)
    const { error } = await client.auth.signInWithPassword({ email, password: PASSWORD })
    if (error) throw new Error(`signIn ${email}: ${errText(error)}`)
    return client
}

async function seed() {
    const admin = await makeUser('admin', 'admin', { admin_permissions: ['*'] })
    const staff = await makeUser('staff', 'cashier')
    const customer = await makeUser('customer', 'customer')
    ids.adminId = admin.id
    ids.staffId = staff.id
    ids.customerId = customer.id

    const cat = await must(service.from('menu_categories').insert({ name: `cat ${TAG}` }).select('id').single(), 'menu_categories')
    ids.categoryId = cat.id
    const menu = await must(service.from('menu_items').insert({ name: `item ${TAG}`, price: 100, category_id: cat.id }).select('id').single(), 'menu_items')
    ids.menuItemId = menu.id
    const table = await must(service.from('tables_layout').insert({ table_name: `T ${TAG}`, shape: 'square', capacity: 2, pos_x: 0, pos_y: 0 }).select('id').single(), 'tables_layout')
    ids.tableId = table.id

    await must(service.from('app_settings').upsert([
        { key: `verify_rls_ordinary_${TAG}`, value: 'ok' },
        { key: 'staff_pin_code', value: 'fixture-not-a-pin' }
    ]), 'app_settings')

    const promo = await must(service.from('promotion_codes').insert({
        code: `VR${Date.now()}`, discount_type: 'fixed', discount_value: 10,
        start_date: new Date(Date.now() - 86400000).toISOString(), end_date: new Date(Date.now() + 86400000).toISOString(),
        applicable_to: 'both', is_active: true
    }).select('id, code').single(), 'promotion_codes')
    ids.promoId = promo.id
    ids.promoCode = promo.code

    const exc = await must(service.from('store_exceptions').insert({ date: '2099-01-01' }).select('id').single(), 'store_exceptions')
    ids.exceptionId = exc.id

    const stock = await must(service.from('stock_items').insert({ name: `stock ${TAG}`, category: 'test', unit: 'g' }).select('id').single(), 'stock_items')
    ids.stockId = stock.id
    const recipe = await must(service.from('recipe_ingredients').insert({ parent_menu_item_id: menu.id, ingredient_id: stock.id, quantity: 1 }).select('id').single(), 'recipe_ingredients')
    ids.recipeId = recipe.id

    const now = new Date().toISOString()
    const b1 = await must(service.from('bookings').insert({ booking_type: 'walk_in', booking_time: now, table_id: table.id, status: 'pending', customer_name: `fixture ${TAG}` }).select('id').single(), 'bookings 1')
    const b2 = await must(service.from('bookings').insert({ booking_type: 'walk_in', booking_time: now, table_id: table.id, status: 'pending', customer_name: `fixture2 ${TAG}` }).select('id').single(), 'bookings 2')
    ids.bookingId = b1.id
    ids.bookingForAdminDelete = b2.id
    const oi = await must(service.from('order_items').insert({ booking_id: b1.id, menu_item_id: menu.id, quantity: 1, price_at_time: 100 }).select('id').single(), 'order_items')
    ids.orderItemId = oi.id

    ids.shiftId = `shift-${TAG}`
    await must(service.from('pos_shifts').insert({ id: ids.shiftId, staff_name: `fixture ${TAG}`, opened_at: now }), 'pos_shifts')

    const taxc = await must(service.from('tax_customer_profiles').insert({ company_name: `co ${TAG}`, tax_id: '0000000000000', address: 'fixture' }).select('id').single(), 'tax_customer_profiles')
    ids.taxCustomerId = taxc.id

    return { admin, staff, customer }
}

async function cleanup() {
    const del = (t, c, v) => (v === undefined || v === null ? null : service.from(t).delete().eq(c, v))
    const steps = [
        () => del('order_items', 'booking_id', ids.bookingId),
        () => service.from('order_items').delete().in('booking_id', ids.anonBookingId ? [ids.anonBookingId] : []),
        () => service.from('bookings').delete().in('id', [ids.bookingId, ids.bookingForAdminDelete, ids.anonBookingId].filter(Boolean)),
        () => del('recipe_ingredients', 'id', ids.recipeId),
        () => del('stock_items', 'id', ids.stockId),
        () => del('menu_items', 'id', ids.menuItemId),
        () => del('menu_categories', 'id', ids.categoryId),
        () => del('tables_layout', 'id', ids.tableId),
        () => del('promotion_codes', 'id', ids.promoId),
        () => del('store_exceptions', 'id', ids.exceptionId),
        () => service.from('pos_shifts').delete().in('id', [ids.shiftId, ids.anonShiftId].filter(Boolean)),
        () => service.from('tax_customer_profiles').delete().in('id', [ids.taxCustomerId, ids.anonTaxCustomerId].filter(Boolean)),
        () => service.from('app_settings').delete().in('key', [`verify_rls_ordinary_${TAG}`, 'staff_pin_code'])
    ]
    for (const s of steps) { try { await s() } catch { /* best effort, local only */ } }
    // tax_invoices cannot be deleted (trigger by design); the local fixture invoice stays.
    for (const id of ids.users) {
        try { await service.from('profiles').delete().eq('id', id) } catch { /* ignore */ }
        try { await service.auth.admin.deleteUser(id) } catch { /* ignore */ }
    }
}

// ---------------------------------------------------------------------------------
// Checks
// ---------------------------------------------------------------------------------
async function backOfficeMustFail(client, who) {
    await expectDeleteBlocked(client, who, 'bookings', 'id', ids.bookingId)
    await expectInsertBlocked(client, who, 'promotion_codes', {
        code: `X${TAG}`, discount_type: 'fixed', discount_value: 1, start_date: new Date().toISOString(),
        end_date: new Date().toISOString(), applicable_to: 'both'
    }, 'code', `X${TAG}`)
    await expectUpdateBlocked(client, who, 'promotion_codes', 'id', ids.promoId, { discount_value: 99 }, 'discount_value')
    await expectDeleteBlocked(client, who, 'promotion_codes', 'id', ids.promoId)
    await expectInsertBlocked(client, who, 'store_exceptions', { date: '2099-12-31', reason: TAG }, 'reason', TAG)
    await expectUpdateBlocked(client, who, 'store_exceptions', 'id', ids.exceptionId, { date: '2099-02-02' }, 'date')
    await expectDeleteBlocked(client, who, 'store_exceptions', 'id', ids.exceptionId)
    await expectReadEmpty(client, who, 'stock_items', 'id', ids.stockId)
    await expectInsertBlocked(client, who, 'stock_items', { name: `X${TAG}`, category: 'x', unit: 'g' }, 'name', `X${TAG}`)
    await expectUpdateBlocked(client, who, 'stock_items', 'id', ids.stockId, { current_quantity: 999 }, 'current_quantity')
    await expectDeleteBlocked(client, who, 'stock_items', 'id', ids.stockId)
    await expectReadEmpty(client, who, 'recipe_ingredients', 'id', ids.recipeId)
    await expectInsertBlocked(client, who, 'recipe_ingredients', { parent_menu_item_id: ids.menuItemId, ingredient_id: ids.stockId, quantity: 777 }, 'quantity', 777)
    await expectUpdateBlocked(client, who, 'recipe_ingredients', 'id', ids.recipeId, { quantity: 5 }, 'quantity')
    await expectDeleteBlocked(client, who, 'recipe_ingredients', 'id', ids.recipeId)
    await expectDeleteBlocked(client, who, 'pos_shifts', 'id', ids.shiftId)
    await expectDeleteBlocked(client, who, 'tax_customer_profiles', 'id', ids.taxCustomerId)

    for (const t of ['staff_pin_credentials', 'staff_pin_legacy_backup']) {
        const { data, error } = await client.from(t).select('*')
        check(!!error && !(data && data.length), `${who} cannot read ${t}`, errText(error))
    }
    {
        const { data, error } = await client.from('app_settings').select('key').eq('key', 'staff_pin_code')
        check(!error && data.length === 0, `${who} cannot read app_settings.staff_pin_code`, `${data ? data.length : 0} rows, ${errText(error)}`)
    }
    await expectRpcRefused(client, who, 'get_staff_offline_pin_hashes', {})
}

async function main() {
    console.log(`verify-rls against ${URL_} (run ${TAG})`)
    const { admin, staff, customer } = await seed()
    const adminClient = await signIn(admin.email)
    const customerClient = await signIn(customer.email)

    // Admin sets the staff PIN through the new function (the only way a PIN gets in)
    {
        const { error } = await adminClient.rpc('admin_set_staff_pin', { p_profile_id: staff.id, p_pin: STAFF_PIN })
        check(!error, 'admin can set a staff PIN (admin_set_staff_pin)', errText(error))
    }

    console.log('\n-- anon must fail')
    await backOfficeMustFail(anon, 'anon')
    {
        const { data, error } = await anon.from('profiles').select('id').not('pin', 'is', null)
        const { count } = await service.from('profiles').select('id', { count: 'exact', head: true }).not('pin', 'is', null)
        check(!error && data.length === 0 && count === 0, 'no profile has a non-null pin', `anon sees ${data ? data.length : '?'}, service counts ${count}, ${errText(error)}`)
    }
    {
        const before = await must(service.from('recipe_ingredients').select('quantity').eq('id', ids.recipeId).single(), 'recipe before')
        const { error } = await anon.rpc('save_menu_recipe', { p_menu_id: ids.menuItemId, p_ingredients: [{ ingredient_id: ids.stockId, quantity: 999, unit: 'g', layer_order: 0 }] })
        const after = await service.from('recipe_ingredients').select('id, quantity').eq('parent_menu_item_id', ids.menuItemId)
        const unchanged = !after.error && after.data.length === 1 && after.data[0].id === ids.recipeId && after.data[0].quantity === before.quantity
        check(!!error && error.code === '42501' && unchanged, 'anon cannot call save_menu_recipe', `${errText(error)}, recipe line ${unchanged ? 'unchanged' : 'CHANGED'}`)
    }
    await expectRpcRefused(anon, 'anon', 'admin_set_staff_pin', { p_profile_id: staff.id, p_pin: '1111' })
    await expectRpcRefused(anon, 'anon', 'admin_staff_pin_status', {})

    console.log('\n-- anon must still succeed (public and POS flows)')
    for (const [t, col, val] of [
        ['menu_items', 'id', ids.menuItemId],
        ['menu_categories', 'id', ids.categoryId],
        ['tables_layout', 'id', ids.tableId],
        ['app_settings', 'key', `verify_rls_ordinary_${TAG}`],
        ['promotion_codes', 'id', ids.promoId]
    ]) {
        const { data, error } = await anon.from(t).select(col).eq(col, val)
        check(!error && data.length === 1, `anon can read ${t}`, `${data ? data.length : 0} rows, ${errText(error)}`)
    }
    {
        const { data, error } = await anon.from('bookings').insert({
            booking_type: 'walk_in', booking_time: new Date().toISOString(), table_id: ids.tableId, status: 'pending', customer_name: `anon ${TAG}`
        }).select('id').single()
        ids.anonBookingId = data && data.id
        check(!error && !!data, 'anon can insert a booking', errText(error))
    }
    {
        const { data, error } = await anon.from('order_items').insert({ booking_id: ids.anonBookingId, menu_item_id: ids.menuItemId, quantity: 2, price_at_time: 100 }).select('id')
        check(!error && data.length === 1, 'anon can insert an order item', errText(error))
    }
    {
        const { data, error } = await anon.from('bookings').update({ status: 'confirmed' }).eq('id', ids.anonBookingId).select('status')
        check(!error && data.length === 1 && data[0].status === 'confirmed', 'anon can update a booking', errText(error))
    }
    {
        ids.anonShiftId = `shift-anon-${TAG}`
        const ins = await anon.from('pos_shifts').insert({ id: ids.anonShiftId, staff_name: 'anon', opened_at: new Date().toISOString() }).select('id')
        check(!ins.error && ins.data.length === 1, 'anon can insert a shift', errText(ins.error))
        const upd = await anon.from('pos_shifts').update({ status: 'closed', closed_at: new Date().toISOString() }).eq('id', ids.anonShiftId).select('status')
        check(!upd.error && upd.data.length === 1 && upd.data[0].status === 'closed', 'anon can update a shift', errText(upd.error))
        const ups = await anon.from('pos_shifts').upsert({ id: ids.anonShiftId, staff_name: 'anon upsert', opened_at: new Date().toISOString() }).select('staff_name')
        check(!ups.error && ups.data.length === 1 && ups.data[0].staff_name === 'anon upsert', 'anon can upsert a shift (offline queue replay)', errText(ups.error))
    }
    {
        const ins = await anon.from('tax_invoices').insert({
            invoice_number: `TMP-${TAG}`, doc_type: 'receipt', customer_name: 'anon', customer_address: '-', booking_id: ids.anonBookingId
        }).select('id')
        check(!ins.error && ins.data.length === 1, 'anon can insert a tax invoice', errText(ins.error))
        const rd = ins.data && ins.data[0] ? await anon.from('tax_invoices').select('id').eq('id', ins.data[0].id) : { data: [], error: null }
        check(!rd.error && rd.data.length === 1, 'anon can read a tax invoice', errText(rd.error))
    }
    {
        const ins = await anon.from('tax_customer_profiles').insert({ company_name: `anon co ${TAG}`, tax_id: '1111111111111', address: 'a' }).select('id').single()
        ids.anonTaxCustomerId = ins.data && ins.data.id
        check(!ins.error && !!ins.data, 'anon can insert a tax customer', errText(ins.error))
        const upd = await anon.from('tax_customer_profiles').update({ address: 'b' }).eq('id', ids.anonTaxCustomerId).select('address')
        check(!upd.error && upd.data.length === 1 && upd.data[0].address === 'b', 'anon can update a tax customer', errText(upd.error))
        const rd = await anon.from('tax_customer_profiles').select('id').eq('id', ids.taxCustomerId)
        check(!rd.error && rd.data.length === 1, 'anon can search tax customers', errText(rd.error))
    }
    {
        const ok = await anon.rpc('verify_staff_pin_login', { p_pin: STAFF_PIN })
        check(!ok.error && ok.data.length === 1 && ok.data[0].id === staff.id, 'verify_staff_pin_login returns the staff member for the right PIN', ok.error ? errText(ok.error) : `${ok.data.length} row(s)`)
        const bad = await anon.rpc('verify_staff_pin_login', { p_pin: '0000' })
        check(!bad.error && bad.data.length === 0, 'verify_staff_pin_login returns nothing for a wrong PIN', bad.error ? errText(bad.error) : `${bad.data.length} row(s)`)
        const junk = await anon.rpc('verify_staff_pin_login', { p_pin: "' or 1=1 --" })
        check(!junk.error && junk.data.length === 0, 'verify_staff_pin_login returns nothing for a non-digit PIN', junk.error ? errText(junk.error) : `${junk.data.length} row(s)`)
        const keys = ok.data && ok.data[0] ? Object.keys(ok.data[0]).sort().join(',') : ''
        check(keys === 'display_name,id,role', 'verify_staff_pin_login returns only id, display_name, role', keys)
    }
    {
        const { data, error } = await anon.rpc('check_promotion', { code_text: ids.promoCode, subtotal: 500, service_type: 'ordering' })
        check(!error && data !== null, 'anon can call check_promotion', error ? errText(error) : JSON.stringify(data).slice(0, 80))
    }
    {
        const { data, error } = await anon.rpc('get_staff_list_safe')
        check(!error && data.some(s => s.id === staff.id), 'anon can call get_staff_list_safe (POS staff list)', errText(error))
    }

    console.log('\n-- signed-in plain customer must fail the same back-office writes')
    await backOfficeMustFail(customerClient, 'customer')
    {
        const { error } = await customerClient.rpc('admin_set_staff_pin', { p_profile_id: customer.id, p_pin: '2468' })
        check(error && error.code === '42501', 'customer cannot call admin_set_staff_pin', errText(error))
        const st = await customerClient.rpc('admin_staff_pin_status')
        check(!st.error && st.data.length === 0, 'customer gets no rows from admin_staff_pin_status', st.error ? errText(st.error) : `${st.data.length} rows`)
    }

    console.log('\n-- signed-in admin must succeed')
    {
        const { data, error } = await adminClient.from('stock_items').select('id').eq('id', ids.stockId)
        check(!error && data.length === 1, 'admin can read stock_items', errText(error))
        const rr = await adminClient.from('recipe_ingredients').select('id').eq('id', ids.recipeId)
        check(!rr.error && rr.data.length === 1, 'admin can read recipe_ingredients', errText(rr.error))
        const su = await adminClient.from('stock_items').update({ current_quantity: 3 }).eq('id', ids.stockId).select('current_quantity')
        check(!su.error && su.data.length === 1, 'admin can update stock_items', errText(su.error))
    }
    {
        const code = `AD${Date.now()}`
        const ins = await adminClient.from('promotion_codes').insert({
            code, discount_type: 'percent', discount_value: 5, start_date: new Date().toISOString(),
            end_date: new Date(Date.now() + 3600000).toISOString(), applicable_to: 'both'
        }).select('id').single()
        check(!ins.error && !!ins.data, 'admin can insert a promotion code', errText(ins.error))
        const upd = ins.data ? await adminClient.from('promotion_codes').update({ discount_value: 6 }).eq('id', ins.data.id).select('discount_value') : { data: [], error: null }
        check(!upd.error && upd.data.length === 1, 'admin can update a promotion code', errText(upd.error))
        const del = ins.data ? await adminClient.from('promotion_codes').delete().eq('id', ins.data.id).select('id') : { data: [], error: null }
        check(!del.error && del.data.length === 1, 'admin can delete a promotion code', errText(del.error))
    }
    {
        const { data, error } = await adminClient.from('bookings').delete().eq('id', ids.bookingForAdminDelete).select('id')
        const gone = !(await rowExists('bookings', 'id', ids.bookingForAdminDelete))
        check(!error && data.length === 1 && gone, 'admin can delete a booking', errText(error))
    }
    {
        const { error } = await adminClient.rpc('admin_set_staff_pin', { p_profile_id: admin.id, p_pin: STAFF_PIN })
        check(error && error.code === '23505', 'admin is refused a duplicate PIN (23505)', errText(error))
        const bad = await adminClient.rpc('admin_set_staff_pin', { p_profile_id: admin.id, p_pin: '12a4' })
        check(bad.error && bad.error.code === '22023', 'admin is refused a non-digit PIN (22023)', errText(bad.error))
        const st = await adminClient.rpc('admin_staff_pin_status')
        const row = st.data && st.data.find(r => r.profile_id === staff.id)
        const keys = row ? Object.keys(row).sort().join(',') : ''
        check(!st.error && !!row && keys === 'profile_id,updated_at', 'admin_staff_pin_status lists the staff PIN without a hash', st.error ? errText(st.error) : keys)
        const sec = await adminClient.from('app_settings').select('key').eq('key', 'staff_pin_code')
        check(!sec.error && sec.data.length === 1, 'admin can still read app_settings.staff_pin_code', errText(sec.error))
        const clr = await adminClient.rpc('admin_set_staff_pin', { p_profile_id: staff.id, p_pin: '' })
        const after = await anon.rpc('verify_staff_pin_login', { p_pin: STAFF_PIN })
        check(!clr.error && !after.error && after.data.length === 0, 'admin can clear a PIN, and the old PIN stops working', errText(clr.error || after.error))
    }

    console.log('\n-- still reachable by anon on purpose (Phase B, docs/security-hardening-plan.md section 5)')
    {
        const u = await anon.from('bookings').update({ customer_name: `anon edit ${TAG}` }).eq('id', ids.bookingId).select('id')
        open(!u.error && u.data.length === 1, 'anon can update any booking')
        const r = await anon.from('bookings').select('id, customer_phone').eq('id', ids.bookingId)
        open(!r.error && r.data.length === 1, 'anon can read bookings (incl. customer phone columns)')
        const oi = await anon.from('order_items').delete().eq('id', ids.orderItemId).select('id')
        open(!oi.error && oi.data.length === 1, 'anon can delete order items (POS removes lines)')
        const ps = await anon.from('pos_shifts').update({ staff_name: `anon edit ${TAG}` }).eq('id', ids.shiftId).select('id')
        open(!ps.error && ps.data.length === 1, 'anon can insert/update pos_shifts')
        const pr = await anon.from('profiles').select('id, phone_number').eq('id', customer.id)
        open(!pr.error && pr.data.length === 1, 'anon can read every profile (profiles_select_all, phone numbers)')
        const ti = await anon.from('tax_invoices').select('id').limit(1)
        open(!ti.error && ti.data.length >= 1, 'anon can read/insert/update tax_invoices and tax_customer_profiles')
        const pc = await anon.from('promotion_codes').select('code').eq('id', ids.promoId)
        open(!pc.error && pc.data.length === 1, 'anon can read every promotion code')
        open(true, 'verify_staff_pin_login is callable by anon without throttling (10,000 PINs)')
        const smr = await customerClient.rpc('save_menu_recipe', { p_menu_id: -1, p_ingredients: [] })
        open(!smr.error, 'save_menu_recipe (SECURITY DEFINER) is still callable by any signed-in user (no role check)')
    }
}

try {
    await main()
} catch (e) {
    failures++
    console.error(`FAIL           script aborted: ${e.message}`)
} finally {
    await cleanup()
}

console.log(`\n${failures === 0 ? 'ALL CHECKS PASSED' : `${failures} CHECK(S) FAILED`}`)
process.exit(failures === 0 ? 0 : 1)
