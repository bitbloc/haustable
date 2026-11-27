import { describe, it, expect } from 'vitest';
import { fetchAllRows } from '../fetchAllRows';

// A fake PostgREST table: like Supabase, a request never returns more than `cap` rows.
const fakeTable = (total, { cap = 1000, failOnPage = -1 } = {}) => {
    const rows = Array.from({ length: total }, (_, i) => ({ id: i + 1 }));
    let calls = 0;
    const make = () => {
        let order = null;
        const q = {
            order(col) { order = col; return q; },
            range(from, to) {
                const page = calls++;
                if (page === failOnPage) return Promise.resolve({ data: null, error: { message: 'boom' } });
                if (order !== 'id') throw new Error('pages must be ordered');
                const end = Math.min(to + 1, from + cap);
                return Promise.resolve({ data: rows.slice(from, end), error: null });
            }
        };
        return q;
    };
    return { make, calls: () => calls };
};

describe('fetchAllRows', () => {
    it('reads past the 1000-row cap (recipe_ingredients had 1129 rows)', async () => {
        const t = fakeTable(1129);
        const { data, error } = await fetchAllRows(t.make);
        expect(error).toBeNull();
        expect(data).toHaveLength(1129);
        expect(data[1128].id).toBe(1129);
        expect(t.calls()).toBe(2);
    });

    it('stops after one short page', async () => {
        const t = fakeTable(12);
        const { data } = await fetchAllRows(t.make);
        expect(data).toHaveLength(12);
        expect(t.calls()).toBe(1);
    });

    it('asks once more when the table is an exact multiple of the page', async () => {
        const t = fakeTable(2000);
        const { data } = await fetchAllRows(t.make);
        expect(data).toHaveLength(2000);
        expect(t.calls()).toBe(3);
    });

    it('returns the error instead of a silently short list', async () => {
        const t = fakeTable(1500, { failOnPage: 1 });
        const { error } = await fetchAllRows(t.make);
        expect(error).toEqual({ message: 'boom' });
    });
});
