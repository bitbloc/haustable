import { describe, it, expect } from 'vitest';
import { resolveTableIdentifier } from '../tableResolver';

describe('resolveTableIdentifier', () => {
    const mockTables = [
        { id: 1, table_name: 'H1' },
        { id: 2, table_name: 'H4' },
        { id: 3, table_name: 'H6' },
        { id: 4, table_name: 'H7' },
        { id: 5, table_name: 'H8' },
        { id: 6, table_name: 'H9' },
        { id: 8, table_name: 'H2' },
        { id: 9, table_name: 'H5' },
        { id: 10, table_name: 'O2' },
        { id: 11, table_name: 'O1' },
        { id: 12, table_name: 'H3' },
    ];

    const mockSupabase = {
        from: (table) => ({
            select: () => ({
                ilike: (col, val) => ({
                    maybeSingle: async () => {
                        const found = mockTables.find(t => t[col]?.toLowerCase() === val?.toLowerCase());
                        return { data: found || null, error: null };
                    }
                }),
                eq: (col, val) => ({
                    maybeSingle: async () => {
                        const found = mockTables.find(t => t[col] === val);
                        return { data: found || null, error: null };
                    }
                })
            })
        })
    };

    it('resolves exact table names like "H9" or "O1"', async () => {
        const h9 = await resolveTableIdentifier('H9', mockSupabase);
        expect(h9).toEqual({ id: 6, table_name: 'H9' });

        const o1 = await resolveTableIdentifier('O1', mockSupabase);
        expect(o1).toEqual({ id: 11, table_name: 'O1' });

        const lowercase = await resolveTableIdentifier('h9', mockSupabase);
        expect(lowercase).toEqual({ id: 6, table_name: 'H9' });
    });

    it('resolves bare digits to "H" prefix tables instead of colliding with DB IDs', async () => {
        // "9" should resolve to table "H9" (id 6), NOT table "H5" (id 9)
        const table9 = await resolveTableIdentifier('9', mockSupabase);
        expect(table9).toEqual({ id: 6, table_name: 'H9' });

        // "2" should resolve to table "H2" (id 8), NOT table "H4" (id 2)
        const table2 = await resolveTableIdentifier('2', mockSupabase);
        expect(table2).toEqual({ id: 8, table_name: 'H2' });

        // "4" should resolve to table "H4" (id 2), NOT table "H7" (id 4)
        const table4 = await resolveTableIdentifier('4', mockSupabase);
        expect(table4).toEqual({ id: 2, table_name: 'H4' });

        // "5" should resolve to table "H5" (id 9), NOT table "H8" (id 5)
        const table5 = await resolveTableIdentifier('5', mockSupabase);
        expect(table5).toEqual({ id: 9, table_name: 'H5' });

        // "6" should resolve to table "H6" (id 3), NOT table "H9" (id 6)
        const table6 = await resolveTableIdentifier('6', mockSupabase);
        expect(table6).toEqual({ id: 3, table_name: 'H6' });

        // "3" should resolve to table "H3" (id 12), NOT table "H6" (id 3)
        const table3 = await resolveTableIdentifier('3', mockSupabase);
        expect(table3).toEqual({ id: 12, table_name: 'H3' });
    });

    it('handles "table 9", "table-9", "โต๊ะ 9"', async () => {
        const res1 = await resolveTableIdentifier('table 9', mockSupabase);
        expect(res1?.table_name).toBe('H9');

        const res2 = await resolveTableIdentifier('table-9', mockSupabase);
        expect(res2?.table_name).toBe('H9');

        const res3 = await resolveTableIdentifier('โต๊ะ 9', mockSupabase);
        expect(res3?.table_name).toBe('H9');
    });

    it('returns null for empty or invalid table params', async () => {
        expect(await resolveTableIdentifier('', mockSupabase)).toBeNull();
        expect(await resolveTableIdentifier(null, mockSupabase)).toBeNull();
        expect(await resolveTableIdentifier('invalid-999', mockSupabase)).toBeNull();
    });
});
