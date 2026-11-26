// Recurring fixed costs (rent, monthly ads, subscriptions). Templates live in
// recurring_expenses; post_recurring_expenses('YYYY-MM') writes each one into
// store_expenses once per month when its day has come. See migration
// 20261126150000_recurring_expenses.sql.
import { supabase } from '../lib/supabaseClient';

export const bangkokMonth = () => new Date(Date.now() + 7 * 3600 * 1000).toISOString().slice(0, 7);

export async function listRecurringExpenses() {
    const { data, error } = await supabase.from('recurring_expenses')
        .select('*').order('active', { ascending: false }).order('day_of_month', { ascending: true });
    if (error) throw error;
    return data || [];
}

export async function saveRecurringExpense(row) {
    const payload = {
        title: String(row.title || '').trim(),
        category: row.category || 'rent',
        vendor_name: String(row.vendor_name || '').trim() || null,
        amount: Number(row.amount),
        day_of_month: Math.min(31, Math.max(1, Number(row.day_of_month) || 1)),
        payment_method: row.payment_method || 'TRANSFER',
        start_month: row.start_month || bangkokMonth(),
        active: row.active !== false,
        notes: String(row.notes || '').trim() || null,
        updated_at: new Date().toISOString(),
    };
    if (!payload.title) throw new Error('กรุณาใส่ชื่อรายการ');
    if (!(payload.amount > 0)) throw new Error('จำนวนเงินต้องมากกว่า 0');
    const query = row.id
        ? supabase.from('recurring_expenses').update(payload).eq('id', row.id).select().single()
        : supabase.from('recurring_expenses').insert(payload).select().single();
    const { data, error } = await query;
    if (error) throw error;
    return data;
}

export async function setRecurringActive(id, active) {
    const { error } = await supabase.from('recurring_expenses')
        .update({ active, updated_at: new Date().toISOString() }).eq('id', id);
    if (error) throw error;
}

/** Posts due templates for a month; returns how many expenses were created (0 on any error). */
export async function postRecurringExpenses(month = bangkokMonth()) {
    try {
        const { data, error } = await supabase.rpc('post_recurring_expenses', { p_month: month });
        if (error) {
            console.warn('[recurring expenses]', error.message);
            return 0;
        }
        return Number(data) || 0;
    } catch (err) {
        console.warn('[recurring expenses]', err?.message || err);
        return 0;
    }
}
