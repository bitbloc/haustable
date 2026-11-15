import { supabase } from '../lib/supabaseClient';

/**
 * The key that identifies one customer in the tax directory: tax ID + branch when there is a
 * tax ID, otherwise the exact name (walk-in individuals without a tax ID).
 */
export function taxCustomerKey(profile = {}) {
    const taxId = String(profile.tax_id || '').replace(/\D/g, '');
    const branch = profile.branch_type === 'branch' ? String(profile.branch_code || '').trim() : '00000';
    if (taxId) return `tax:${taxId}|${branch || '00000'}`;
    return `name:${String(profile.company_name || '').trim().toLowerCase()}`;
}

/**
 * Saves a buyer to the tax customer directory without creating duplicates: if a profile with
 * the same tax ID and branch (or, with no tax ID, the same name) exists, it is updated with the
 * latest details; otherwise a new one is added. Throws on a database error.
 * @returns {Promise<{ record: object, updated: boolean }>}
 */
export async function saveTaxCustomerProfile(payload) {
    const taxId = String(payload.tax_id || '').replace(/\D/g, '');
    const branchCode = payload.branch_type === 'branch' ? String(payload.branch_code || '').trim() : '00000';
    const clean = { ...payload, tax_id: taxId, branch_code: branchCode };

    let query = supabase.from('tax_customer_profiles').select('id').order('updated_at', { ascending: false }).limit(1);
    query = taxId
        ? query.eq('tax_id', taxId).eq('branch_code', branchCode)
        : query.eq('tax_id', '').ilike('company_name', String(payload.company_name || '').trim());
    const { data: existing, error: findErr } = await query.maybeSingle();
    if (findErr) throw findErr;

    if (existing?.id) {
        const { data, error } = await supabase
            .from('tax_customer_profiles')
            .update({ ...clean, updated_at: new Date().toISOString() })
            .eq('id', existing.id)
            .select()
            .single();
        if (error) throw error;
        return { record: data, updated: true };
    }

    const { data, error } = await supabase.from('tax_customer_profiles').insert([clean]).select().single();
    if (error) throw error;
    return { record: data, updated: false };
}
