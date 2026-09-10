/**
 * Utility for resolving table identifiers (URL params, QR codes, manual entry)
 * Fully synchronized with backend tables_layout in Supabase.
 * Handles exact names, custom prefixes (VIP, BAR, T, H, O, etc.), normalized formats, and digit mapping.
 */

/**
 * Normalizes a table identifier by stripping common prefixes ("table", "โต๊ะ", "tb"),
 * punctuation, hyphens, underscores, and whitespace, converting to lowercase.
 * E.g. "VIP-1" -> "vip1", "table_9" -> "9", "โต๊ะ 2" -> "2", "Bar 1" -> "bar1"
 * 
 * @param {string|number} str 
 * @returns {string}
 */
export function normalizeTableCode(str) {
    if (!str && str !== 0) return '';
    return String(str)
        .trim()
        .toLowerCase()
        .replace(/^(table|โต๊ะ|tb)[-_ ]*/i, '')
        .replace(/[-_ .]/g, '');
}

/**
 * Resolves a table parameter string to its corresponding tables_layout record.
 * 
 * Priority order:
 * 1. Exact match on table_name (case-insensitive, e.g. "H9", "VIP-1", "Bar 2")
 * 2. Normalized/Canonical match against active backend tables in tables_layout (e.g. "vip1" <=> "VIP-1")
 * 3. Dynamic numeric/trailing digit match against active tables in tables_layout (e.g. "9" -> "H9", "10" -> "H10")
 * 4. Fallback to primary key DB ID (only if purely numeric and exists in tables_layout)
 * 5. Returns null if table does not exist or was deleted in the backend
 * 
 * @param {string|number} tableParam - Raw table parameter from URL or QR code
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<object|null>} Resolved table record or null
 */
export async function resolveTableIdentifier(tableParam, supabase) {
    if (!tableParam || !supabase) return null;

    const raw = String(tableParam).trim();
    if (!raw) return null;

    // Clean common prefixes (e.g. "table-9" -> "9", "table_9" -> "9", "t9" -> "9", "โต๊ะ 9" -> "9")
    const cleanParam = raw.replace(/^(table|โต๊ะ|tb)[-_ ]*/i, '').trim() || raw;
    const isDigitsOnly = /^\d+$/.test(cleanParam);
    const digitsOnly = cleanParam.replace(/\D/g, '');

    try {
        // Priority 1: Exact case-insensitive match on table_name (e.g. "H9", "O1", "VIP-1", "Bar 2")
        const { data: byExactName } = await supabase
            .from('tables_layout')
            .select('*')
            .ilike('table_name', cleanParam)
            .maybeSingle();

        if (byExactName) {
            return byExactName;
        }

        // Priority 2: Fetch all active tables from tables_layout for dynamic canonical & digit matching
        // (Restaurant floorplan is small: typically 10-50 rows, lightning fast sub-10ms query)
        const { data: allTables, error: fetchErr } = await supabase
            .from('tables_layout')
            .select('*')
            .order('id');

        if (!fetchErr && Array.isArray(allTables) && allTables.length > 0) {
            const normalizedParam = normalizeTableCode(cleanParam);

            // 2a. Canonical match against existing active tables (e.g. "vip1" matches "VIP-1", "bar1" matches "Bar 1")
            const byNormalized = allTables.find(t => normalizeTableCode(t.table_name) === normalizedParam);
            if (byNormalized) {
                return byNormalized;
            }

            // Priority 3: If input contains digits, match against existing tables with matching digits
            // E.g. "9" matches existing table "H9" or "VIP9"
            if (digitsOnly) {
                const matchingTables = allTables.filter(t => {
                    const tDigits = String(t.table_name || '').replace(/\D/g, '');
                    return tDigits === digitsOnly;
                });

                if (matchingTables.length === 1) {
                    return matchingTables[0];
                } else if (matchingTables.length > 1) {
                    // Prioritize standard table prefixes: H > T > VIP > B > O > others
                    const getPrefixScore = (name) => {
                        const n = String(name || '').toUpperCase();
                        if (n.startsWith('H')) return 1;
                        if (n.startsWith('T')) return 2;
                        if (n.startsWith('VIP')) return 3;
                        if (n.startsWith('B')) return 4;
                        if (n.startsWith('O')) return 5;
                        return 10;
                    };
                    matchingTables.sort((a, b) => getPrefixScore(a.table_name) - getPrefixScore(b.table_name));
                    return matchingTables[0];
                }
            }

            // Priority 4: Fallback to primary key ID (only if purely numeric and exists in active tables)
            if (isDigitsOnly) {
                const numId = parseInt(cleanParam, 10);
                if (!isNaN(numId)) {
                    const byId = allTables.find(t => t.id === numId);
                    if (byId) {
                        return byId;
                    }
                }
            }
        } else {
            // Priority 4 Fallback if bulk select was not available: direct query by primary key ID
            if (isDigitsOnly) {
                const numId = parseInt(cleanParam, 10);
                if (!isNaN(numId)) {
                    const { data: byId } = await supabase
                        .from('tables_layout')
                        .select('*')
                        .eq('id', numId)
                        .maybeSingle();

                    if (byId) {
                        return byId;
                    }
                }
            }
        }
    } catch (err) {
        console.error('[tableResolver] Resolution error for parameter:', tableParam, err);
    }

    return null;
}

