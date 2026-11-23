-- ==============================================================================
-- Guarded Stock Audit Repair (2026-11-23)
--
-- Part 1: Restore the 4 shelf items that were hidden (item_type='recipe') and
--         had their units wiped by the legacy StockItemForm is_base_recipe bug.
--         Does NOT change current_quantity and does NOT delete any rows.
-- Part 2: Align 5 older bar prep items from unit='unit' to unit='portion'
--         (displayed as 'สูตร') to match all other 21 prep items.
--
-- Each UPDATE is guarded by its exact current state so already-edited rows are
-- never overwritten.
-- Apply:
--   npx supabase db query --remote --yes -f supabase/repairs/20261123_restore_hidden_stock_items.sql
-- ==============================================================================

BEGIN;

-- 1a. ฟักทอง/ถุง (แพ็คแล้ว) — 47 bags hidden on 2026-11-23; restore raw + 1 bag = 50 g
UPDATE public.stock_items
SET item_type = 'raw',
    is_base_recipe = false,
    pack_size = 1,
    pack_unit = 'bag',
    unit = 'bag',
    usage_unit = 'g',
    conversion_factor = 50,
    updated_at = timezone('utc'::text, now())
WHERE id = '530ab606-4a86-4d3a-a2e6-0e93b1960008'
  AND item_type = 'recipe';

-- 1b. ต้นหอม/แพ็ค — 0.3 kg, ฿120; restore raw + 1 kg = 1,000 g
UPDATE public.stock_items
SET item_type = 'raw',
    is_base_recipe = false,
    pack_size = 1,
    pack_unit = 'kg',
    unit = 'kg',
    usage_unit = 'g',
    conversion_factor = 1000,
    updated_at = timezone('utc'::text, now())
WHERE id = '1485ffe0-11f9-4fc5-9707-b07ec3412647'
  AND item_type = 'recipe';

-- 1c. พริกแดงจินดา/กก — ฿80, used in 2 recipes in g (5 g and 150 g); restore raw + 1 kg = 1,000 g
UPDATE public.stock_items
SET item_type = 'raw',
    is_base_recipe = false,
    pack_size = 1,
    pack_unit = 'kg',
    unit = 'kg',
    usage_unit = 'g',
    conversion_factor = 1000,
    updated_at = timezone('utc'::text, now())
WHERE id = '0aee4efb-b133-418b-98c6-61ec502667b1'
  AND item_type = 'recipe';

-- 1d. เนื้อน่องลายตุ๋น/แพ็ค — 31 bags, ฿68; restore raw + bag (staff can set g/bag if used in recipes)
UPDATE public.stock_items
SET item_type = 'raw',
    is_base_recipe = false,
    pack_size = 1,
    pack_unit = 'bag',
    unit = 'bag',
    usage_unit = 'bag',
    conversion_factor = 1,
    updated_at = timezone('utc'::text, now())
WHERE id = '85a44e37-6f2b-4b1c-b33a-d9d1f57d61d6'
  AND item_type = 'recipe';

-- 2. Older bar prep items (qty = 0, unit = 'unit') -> unit = 'portion' (displays as 'สูตร')
UPDATE public.stock_items
SET unit = 'portion',
    updated_at = timezone('utc'::text, now())
WHERE id IN (
    '7f6bd657-752f-492b-b47e-dc9f41812c34', -- นมมิกซ์
    '1b0cddb0-2610-44c3-9497-53897ef7e98a', -- เบสโกโก้
    '22f23f37-b63c-4e81-b84f-1340101a9892', -- เบสชาดำ
    '8d4afc0f-e6ae-4dcb-aa1f-c584983d5ed3', -- เบสชาไทย
    '4b96a696-e419-475e-a3a6-2c4a035095d7'  -- เบสชามะลิ
)
  AND item_type = 'prep'
  AND unit = 'unit';

COMMIT;

-- Verify
SELECT id, name, item_type, is_base_recipe, unit, pack_unit, usage_unit, conversion_factor, cost_price, current_quantity
FROM public.stock_items
WHERE id IN (
    '530ab606-4a86-4d3a-a2e6-0e93b1960008',
    '1485ffe0-11f9-4fc5-9707-b07ec3412647',
    '0aee4efb-b133-418b-98c6-61ec502667b1',
    '85a44e37-6f2b-4b1c-b33a-d9d1f57d61d6',
    '7f6bd657-752f-492b-b47e-dc9f41812c34',
    '1b0cddb0-2610-44c3-9497-53897ef7e98a',
    '22f23f37-b63c-4e81-b84f-1340101a9892',
    '8d4afc0f-e6ae-4dcb-aa1f-c584983d5ed3',
    '4b96a696-e419-475e-a3a6-2c4a035095d7'
)
ORDER BY item_type, name;
