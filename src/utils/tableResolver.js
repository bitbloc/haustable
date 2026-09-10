/**
 * Utility for resolving table identifiers (URL params, QR codes, manual entry)
 * Handles table naming conventions: "H1".."H9", "O1", "O2" as well as numeric inputs ("9" -> "H9").
 */

/**
 * Resolves a table parameter string to its corresponding tables_layout record.
 * 
 * Priority order:
 * 1. Exact match on table_name (case-insensitive, e.g. "H9", "O1", "11")
 * 2. If input is purely digits or has "table" prefix:
 *    - Try "H" + number (e.g. "9" -> "H9", "5" -> "H5")
 *    - Try "O" + number (e.g. "1" -> "O1", "2" -> "O2")
 * 3. Fallback to primary key id (e.g. legacy numeric QR codes)
 * 
 * @param {string|number} tableParam - Raw table parameter from URL or QR code
 * @param {object} supabase - Supabase client instance
 * @returns {Promise<object|null>} Resolved table record or null
 */
export async function resolveTableIdentifier(tableParam, supabase) {
    if (!tableParam || !supabase) return null;

    const raw = String(tableParam).trim();
    if (!raw) return null;

    // Clean common prefixes (e.g. "table-9" -> "9", "table_9" -> "9", "t9" -> "9")
    const cleanParam = raw.replace(/^(table|โต๊ะ)[-_ ]*/i, '').trim() || raw;
    const isDigitsOnly = /^\d+$/.test(cleanParam);
    const digitsOnly = cleanParam.replace(/\D/g, '');

    try {
        // Priority 1: Exact case-insensitive match on table_name (e.g. "H9", "O2")
        const { data: byExactName } = await supabase
            .from('tables_layout')
            .select('*')
            .ilike('table_name', cleanParam)
            .maybeSingle();

        if (byExactName) {
            return byExactName;
        }

        // Priority 2: If input has numeric digits (e.g. "9", "table 9"):
        // Try prefixed names first ("H9", then "O9") to avoid collision with numeric DB IDs
        if (digitsOnly) {
            // Try 'H' + digits (most in-house tables: H1..H9)
            const { data: byHName } = await supabase
                .from('tables_layout')
                .select('*')
                .ilike('table_name', `H${digitsOnly}`)
                .maybeSingle();

            if (byHName) {
                return byHName;
            }

            // Try 'O' + digits (outdoor tables: O1..O2)
            const { data: byOName } = await supabase
                .from('tables_layout')
                .select('*')
                .ilike('table_name', `O${digitsOnly}`)
                .maybeSingle();

            if (byOName) {
                return byOName;
            }
        }

        // Priority 3: Fallback to primary key ID (only if purely numeric and no table_name matched)
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
    } catch (err) {
        console.error('[tableResolver] Resolution error for parameter:', tableParam, err);
    }

    return null;
}
