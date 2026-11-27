/**
 * Supabase (PostgREST) returns at most 1000 rows per request, silently. A whole-table read
 * like recipe_ingredients (1129 rows on 2026-11-27) loses the rest without an error, so menus
 * whose lines fall past row 1000 look like they have no recipe.
 *
 * `makeQuery` builds a fresh select (filters allowed, no order/range): it is called once per page.
 * Pages are ordered by `orderColumn` so no row is skipped or read twice between pages.
 * Returns { data, error } like a normal query.
 */
export const PAGE_SIZE = 1000;
const MAX_PAGES = 50;

export async function fetchAllRows(makeQuery, { orderColumn = 'id', pageSize = PAGE_SIZE } = {}) {
    const rows = [];
    for (let page = 0; page < MAX_PAGES; page++) {
        const from = page * pageSize;
        const { data, error } = await makeQuery()
            .order(orderColumn, { ascending: true })
            .range(from, from + pageSize - 1);
        if (error) return { data: rows.length ? rows : null, error };
        rows.push(...(data || []));
        if (!data || data.length < pageSize) break;
    }
    return { data: rows, error: null };
}
