import { describe, it, expect } from 'vitest';
import { resolveTableIdentifier, normalizeTableCode } from '../tableResolver';

describe('normalizeTableCode', () => {
    it('strips common table prefixes and punctuation', () => {
        expect(normalizeTableCode('Table-9')).toBe('9');
        expect(normalizeTableCode('table_9')).toBe('9');
        expect(normalizeTableCode('โต๊ะ 9')).toBe('9');
        expect(normalizeTableCode('tb-1')).toBe('1');
        expect(normalizeTableCode('VIP-1')).toBe('vip1');
        expect(normalizeTableCode('Bar 2')).toBe('bar2');
        expect(normalizeTableCode('H-9')).toBe('h9');
        expect(normalizeTableCode('')).toBe('');
        expect(normalizeTableCode(null)).toBe('');
    });
});

describe('resolveTableIdentifier - Dynamic Backend Table Sync', () => {
    const baseMockTables = [
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

    const createMockSupabase = (tables = baseMockTables) => ({
        from: (tableName) => ({
            select: () => {
                const queryObj = {
                    order: async () => ({ data: tables, error: null }),
                    ilike: (col, val) => ({
                        maybeSingle: async () => {
                            const found = tables.find(t => t[col]?.toLowerCase() === val?.toLowerCase());
                            return { data: found || null, error: null };
                        }
                    }),
                    eq: (col, val) => ({
                        maybeSingle: async () => {
                            const found = tables.find(t => t[col] === val);
                            return { data: found || null, error: null };
                        }
                    })
                };
                return queryObj;
            }
        })
    });

    it('resolves exact table names like "H9" or "O1"', async () => {
        const mockSupabase = createMockSupabase();
        const h9 = await resolveTableIdentifier('H9', mockSupabase);
        expect(h9).toEqual({ id: 6, table_name: 'H9' });

        const o1 = await resolveTableIdentifier('O1', mockSupabase);
        expect(o1).toEqual({ id: 11, table_name: 'O1' });

        const lowercase = await resolveTableIdentifier('h9', mockSupabase);
        expect(lowercase).toEqual({ id: 6, table_name: 'H9' });
    });

    it('resolves custom tables dynamically added by backend admin (VIP-1, Bar 2, T10)', async () => {
        const customTables = [
            ...baseMockTables,
            { id: 20, table_name: 'VIP-1' },
            { id: 21, table_name: 'Bar 2' },
            { id: 22, table_name: 'T10' },
            { id: 23, table_name: 'B5' },
        ];
        const mockSupabase = createMockSupabase(customTables);

        // Exact match
        expect((await resolveTableIdentifier('VIP-1', mockSupabase))?.id).toBe(20);
        expect((await resolveTableIdentifier('Bar 2', mockSupabase))?.id).toBe(21);
        expect((await resolveTableIdentifier('T10', mockSupabase))?.id).toBe(22);

        // Normalized canonical matching (handling spaces, hyphens, prefixes)
        expect((await resolveTableIdentifier('vip1', mockSupabase))?.id).toBe(20);
        expect((await resolveTableIdentifier('VIP 1', mockSupabase))?.id).toBe(20);
        expect((await resolveTableIdentifier('table-vip1', mockSupabase))?.id).toBe(20);
        expect((await resolveTableIdentifier('bar-2', mockSupabase))?.id).toBe(21);
        expect((await resolveTableIdentifier('bar2', mockSupabase))?.id).toBe(21);
        expect((await resolveTableIdentifier('โต๊ะ b5', mockSupabase))?.id).toBe(23);

        // Dynamic digit matching for new table
        expect((await resolveTableIdentifier('10', mockSupabase))?.table_name).toBe('T10');
    });

    it('resolves bare digits to existing backend tables without ID collision', async () => {
        const mockSupabase = createMockSupabase();

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
    });

    it('handles Thai and English table prefixes: "table 9", "table-9", "โต๊ะ 9"', async () => {
        const mockSupabase = createMockSupabase();
        const res1 = await resolveTableIdentifier('table 9', mockSupabase);
        expect(res1?.table_name).toBe('H9');

        const res2 = await resolveTableIdentifier('table-9', mockSupabase);
        expect(res2?.table_name).toBe('H9');

        const res3 = await resolveTableIdentifier('โต๊ะ 9', mockSupabase);
        expect(res3?.table_name).toBe('H9');
    });

    it('immediately reflects table deletions from backend (returns null, no ghost tables)', async () => {
        // Suppose admin deletes table H4 (id 2) in backend
        const remainingTables = baseMockTables.filter(t => t.table_name !== 'H4');
        const mockSupabase = createMockSupabase(remainingTables);

        // Attempting to resolve deleted H4 should return null
        expect(await resolveTableIdentifier('H4', mockSupabase)).toBeNull();
        expect(await resolveTableIdentifier('table-h4', mockSupabase)).toBeNull();
    });

    it('reflects table renaming from backend', async () => {
        // Suppose admin renames H9 to BAR-9 in backend
        const updatedTables = baseMockTables.map(t => t.table_name === 'H9' ? { ...t, table_name: 'BAR-9' } : t);
        const mockSupabase = createMockSupabase(updatedTables);

        expect((await resolveTableIdentifier('BAR-9', mockSupabase))?.table_name).toBe('BAR-9');
        expect((await resolveTableIdentifier('bar9', mockSupabase))?.table_name).toBe('BAR-9');
        // Resolving digit 9 now resolves to the renamed table BAR-9
        expect((await resolveTableIdentifier('9', mockSupabase))?.table_name).toBe('BAR-9');
    });

    it('falls back to DB primary key ID if no name match and table ID exists', async () => {
        const tablesWithLegacy = [
            { id: 99, table_name: 'SPECIAL_ROOM' }
        ];
        const mockSupabase = createMockSupabase(tablesWithLegacy);

        // Resolving by primary key '99'
        const res = await resolveTableIdentifier('99', mockSupabase);
        expect(res?.table_name).toBe('SPECIAL_ROOM');
    });

    it('returns null for empty or invalid table params', async () => {
        const mockSupabase = createMockSupabase();
        expect(await resolveTableIdentifier('', mockSupabase)).toBeNull();
        expect(await resolveTableIdentifier(null, mockSupabase)).toBeNull();
        expect(await resolveTableIdentifier('invalid-999', mockSupabase)).toBeNull();
    });
});
