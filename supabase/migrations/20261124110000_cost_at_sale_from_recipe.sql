-- cost_at_sale: take the cost of a sold line from its recipe (audit 2026-11-24)
--
-- order_items.cost_at_sale was copied from menu_items.fixed_cost, a column nothing fills,
-- so every sale carried a cost of 0 and the financial dashboard showed no cost of goods.
--
-- Now a new line is costed from what its recipe takes out of stock, at today's prices:
-- the same explosion the stock shadow uses (recipe + chosen options + sweetness level +
-- takeaway packaging), each ingredient at its cost per counted unit. The figure is the
-- cost of ONE unit of the line, as before. menu_items.fixed_cost stays as the fallback
-- for a menu with no recipe.
--
-- This runs inside the BEFORE INSERT trigger on order_items, i.e. on every order the POS
-- writes. It must never stop an order: any error in the costing falls back to the old
-- behaviour, and an implausible figure is ignored.
--
-- Past sales are not touched.

BEGIN;

CREATE OR REPLACE FUNCTION public.menu_sale_unit_cost(
    p_menu_item_id bigint,
    p_options jsonb DEFAULT NULL,
    p_is_takeaway boolean DEFAULT false)
RETURNS numeric
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
    SELECT round(COALESCE(SUM(q.stock_qty * public.stock_count_unit_cost(si)), 0), 2)
    FROM public.stock_requirements_for_sale(p_menu_item_id, 1, p_options, COALESCE(p_is_takeaway, false)) q
    JOIN public.stock_items si ON si.id = q.stock_item_id;
$function$;

REVOKE ALL ON FUNCTION public.menu_sale_unit_cost(bigint, jsonb, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.menu_sale_unit_cost(bigint, jsonb, boolean) TO service_role;

-- Live body (pg_get_functiondef, 2026-11-24) with part A extended; B and C are unchanged.
CREATE OR REPLACE FUNCTION public.fn_order_items_enrich_snapshots()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_fixed_cost NUMERIC(10, 2) := 0.00;
    v_recipe_cost NUMERIC := NULL;
    v_booking_type VARCHAR(50) := 'dine_in';
    v_category_name VARCHAR(100) := NULL;
BEGIN
    -- A. บันทึกต้นทุนสินค้า ณ เวลาที่ขาย (ถ้ายังไม่ได้ระบุ)
    IF NEW.cost_at_sale IS NULL OR NEW.cost_at_sale = 0 THEN
        IF NEW.menu_item_id IS NOT NULL THEN
            -- ต้นทุนจากสูตร ณ ราคาวัตถุดิบวันนี้; พลาดเมื่อไรใช้ค่าเดิม ไม่ขวางออเดอร์
            IF NOT COALESCE(NEW.is_custom, false) THEN
                BEGIN
                    v_recipe_cost := public.menu_sale_unit_cost(
                        NEW.menu_item_id,
                        NEW.selected_options,
                        public.is_takeaway_sale(NEW.booking_id, NEW.channel));
                EXCEPTION WHEN OTHERS THEN
                    v_recipe_cost := NULL;
                END;
            END IF;

            IF v_recipe_cost IS NOT NULL AND v_recipe_cost > 0 AND v_recipe_cost < 100000 THEN
                NEW.cost_at_sale := v_recipe_cost;
            ELSE
                SELECT COALESCE(fixed_cost, 0.00) INTO v_fixed_cost
                FROM public.menu_items
                WHERE id = NEW.menu_item_id;

                NEW.cost_at_sale := COALESCE(v_fixed_cost, 0.00);
            END IF;
        END IF;
    END IF;

    -- B. บันทึกช่องทางขาย (dine_in / takeaway / ฯลฯ)
    IF NEW.channel IS NULL OR NEW.channel = '' OR NEW.channel = 'dine_in' THEN
        IF NEW.booking_id IS NOT NULL THEN
            SELECT COALESCE(booking_type, 'dine_in') INTO v_booking_type
            FROM public.bookings
            WHERE id = NEW.booking_id;

            NEW.channel := COALESCE(v_booking_type, 'dine_in');
        END IF;
    END IF;

    -- C. บันทึกชื่อหมวดหมู่สินค้า
    IF NEW.category_snapshot IS NULL OR NEW.category_snapshot = '' THEN
        IF NEW.menu_item_id IS NOT NULL THEN
            SELECT mc.name INTO v_category_name
            FROM public.menu_items mi
            LEFT JOIN public.menu_categories mc ON mi.category_id = mc.id
            WHERE mi.id = NEW.menu_item_id;

            NEW.category_snapshot := v_category_name;
        END IF;
    END IF;

    RETURN NEW;
END;
$function$;

COMMIT;
