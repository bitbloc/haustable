-- Set menus deduct the recipes of the menus they are made of (2026-11-27)
--
-- The seven set menus had no recipe. A rice + drink set deducted the drink the customer
-- chose and nothing of the rice bowl; a Set L / XL deducted nothing, and both recorded
-- almost no cost. Copying every dish's ingredients into each set would be 50-60 lines per
-- set that drift from the dish the day its recipe changes.
--
-- 1. menu_set_components: "this set is made of these menus, this many servings each".
--    Selling the set deducts each component's own recipe, so a recipe is still edited in
--    one place. choice_ids fixes option choices of the component (แกงส้มกุ้ง in a set is
--    always the pickled bamboo version). One level only: a set cannot contain a set.
--
-- 2. option_choice_ingredients.linked_choice_ids: a choice that deducts another menu's
--    recipe (set drink pairing) can also fix that menu's own choices. The drink recipes
--    hold only the liquid; cup, lid, straw, ice and the coffee beans sit on the drink's
--    "เย็น" and "Coffee Bean" choices, which a set never passes on, so set drinks
--    deducted the liquid alone.
--
-- 3. stock_requirements_for_sale is rebuilt on two helpers (a menu's recipe, one choice's
--    rules) and gains the set step. Menus that are not sets get the same rows as before.
--    menu_sale_unit_cost reads this function, so cost_at_sale follows without a change.
--
-- 4. save_menu_set_components: one transaction, back-office staff only.
--
-- 5. recompute_sale_stock_shadow(p_menu_item_id): also the lines of sets containing that menu.
--
-- 6. Data: components of the seven sets, and the fixed choices of the set drinks.
--
-- POS: nothing here can stop an order. Both order_items triggers that reach these functions
-- (stock shadow, cost_at_sale) swallow their errors. No existing table is rewritten.
--
-- Apply this file alone:
--   npx supabase db query --remote --yes -f supabase/migrations/20261127120000_menu_set_components.sql
-- Safe to re-run (seed rows never overwrite what was edited since).

BEGIN;

-- ------------------------------------------------------------------------------
-- 1. Set components
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.menu_set_components (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_menu_item_id BIGINT NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    component_menu_item_id BIGINT NOT NULL REFERENCES public.menu_items(id) ON DELETE CASCADE,
    quantity NUMERIC(10, 4) NOT NULL DEFAULT 1 CHECK (quantity > 0),
    choice_ids UUID[] NOT NULL DEFAULT '{}',
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT menu_set_components_not_self CHECK (set_menu_item_id <> component_menu_item_id),
    CONSTRAINT menu_set_components_unique UNIQUE (set_menu_item_id, component_menu_item_id)
);

CREATE INDEX IF NOT EXISTS idx_menu_set_components_component
    ON public.menu_set_components (component_menu_item_id);

COMMENT ON TABLE public.menu_set_components IS
  'A set menu is made of other menus: selling the set deducts quantity servings of each component''s recipe.';
COMMENT ON COLUMN public.menu_set_components.choice_ids IS
  'Option choices of the component that the set always uses (their stock rules are deducted too).';

ALTER TABLE public.menu_set_components ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS menu_set_components_backoffice_all ON public.menu_set_components;
CREATE POLICY menu_set_components_backoffice_all ON public.menu_set_components
    FOR ALL TO authenticated
    USING (public.is_backoffice_staff())
    WITH CHECK (public.is_backoffice_staff());

REVOKE ALL ON public.menu_set_components FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.menu_set_components TO authenticated;
GRANT ALL ON public.menu_set_components TO service_role;

-- One level only: a set is not a component, a component is not a set.
CREATE OR REPLACE FUNCTION public.trg_fn_menu_set_components_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    IF EXISTS (SELECT 1 FROM public.menu_set_components c
               WHERE c.set_menu_item_id = NEW.component_menu_item_id) THEN
        RAISE EXCEPTION 'SET_IN_SET: menu % is itself a set', NEW.component_menu_item_id
            USING ERRCODE = '23514';
    END IF;
    IF EXISTS (SELECT 1 FROM public.menu_set_components c
               WHERE c.component_menu_item_id = NEW.set_menu_item_id) THEN
        RAISE EXCEPTION 'SET_IN_SET: menu % is already part of a set', NEW.set_menu_item_id
            USING ERRCODE = '23514';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_menu_set_components_guard ON public.menu_set_components;
CREATE TRIGGER trg_menu_set_components_guard
    BEFORE INSERT OR UPDATE OF set_menu_item_id, component_menu_item_id
    ON public.menu_set_components
    FOR EACH ROW EXECUTE FUNCTION public.trg_fn_menu_set_components_guard();

-- ------------------------------------------------------------------------------
-- 2. Fixed choices of a menu deducted by an option
-- ------------------------------------------------------------------------------
ALTER TABLE public.option_choice_ingredients
    ADD COLUMN IF NOT EXISTS linked_choice_ids UUID[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN public.option_choice_ingredients.linked_choice_ids IS
  'With linked_menu_item_id: option choices of that menu which are always deducted with its recipe (e.g. เย็น, the house coffee bean).';

-- ------------------------------------------------------------------------------
-- 3. What one sale deducts
-- ------------------------------------------------------------------------------

-- Sweetness multiplier of a list of choices: the product of every one that has a factor.
CREATE OR REPLACE FUNCTION public.option_sweetener_factor(p_choice_ids UUID[])
RETURNS NUMERIC
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_factor NUMERIC := 1;
    v_f NUMERIC;
BEGIN
    IF p_choice_ids IS NULL OR cardinality(p_choice_ids) = 0 THEN
        RETURN 1;
    END IF;
    FOR v_f IN
        SELECT oc.sweetener_factor FROM public.option_choices oc
        WHERE oc.id = ANY (p_choice_ids) AND oc.sweetener_factor IS NOT NULL
    LOOP
        v_factor := v_factor * v_f;
    END LOOP;
    RETURN v_factor;
END;
$$;

-- The recipe of one menu, down to stock items.
CREATE OR REPLACE FUNCTION public.stock_requirements_for_menu_recipe(
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_factor NUMERIC DEFAULT 1,
    p_is_takeaway BOOLEAN DEFAULT false
)
RETURNS TABLE (stock_item_id UUID, stock_qty NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_takeaway BOOLEAN := COALESCE(p_is_takeaway, false);
    v_factor NUMERIC := COALESCE(p_factor, 1);
BEGIN
    IF p_menu_item_id IS NULL OR COALESCE(p_quantity, 0) = 0 THEN
        RETURN;
    END IF;

    FOR r IN
        SELECT ri.ingredient_id,
               ri.quantity::numeric * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END AS quantity
        FROM public.recipe_ingredients ri
        JOIN public.stock_items si ON si.id = ri.ingredient_id
        WHERE ri.parent_menu_item_id = p_menu_item_id
          AND ri.ingredient_id IS NOT NULL
          AND (
              COALESCE(ri.order_scope, 'all') = 'all'
              OR (v_takeaway AND ri.order_scope = 'takeaway')
              OR (NOT v_takeaway AND ri.order_scope = 'dine_in')
          )
    LOOP
        RETURN QUERY
            SELECT q.stock_item_id, q.stock_qty
            FROM public.stock_recipe_requirements(r.ingredient_id, r.quantity * p_quantity, 1) q;
    END LOOP;
END;
$$;

-- The stock rules of one option choice on one menu. Rows written for that menu replace
-- the "every menu" rows of the choice. A rule that points at another menu deducts that
-- menu's recipe and, one level deep, the choices fixed on the rule.
CREATE OR REPLACE FUNCTION public.stock_requirements_for_choice(
    p_choice_id UUID,
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_factor NUMERIC DEFAULT 1,
    p_is_takeaway BOOLEAN DEFAULT false,
    p_depth INT DEFAULT 0
)
RETURNS TABLE (stock_item_id UUID, stock_qty NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_has_specific BOOLEAN;
    v_fixed UUID;
    v_factor NUMERIC := COALESCE(p_factor, 1);
    v_linked_factor NUMERIC;
BEGIN
    IF p_choice_id IS NULL OR COALESCE(p_quantity, 0) = 0 THEN
        RETURN;
    END IF;

    SELECT EXISTS (SELECT 1 FROM public.option_choice_ingredients oci
                   WHERE oci.choice_id = p_choice_id AND oci.menu_item_id = p_menu_item_id)
    INTO v_has_specific;

    FOR r IN
        SELECT oci.stock_item_id AS item_id,
               oci.linked_menu_item_id AS linked_id,
               oci.quantity::numeric AS quantity,
               COALESCE(oci.linked_choice_ids, '{}') AS linked_choice_ids
        FROM public.option_choice_ingredients oci
        WHERE oci.choice_id = p_choice_id
          AND (CASE WHEN v_has_specific THEN oci.menu_item_id = p_menu_item_id
                    ELSE oci.menu_item_id IS NULL END)
    LOOP
        IF r.item_id IS NOT NULL THEN
            RETURN QUERY
                SELECT q.stock_item_id, q.stock_qty
                FROM public.stock_items si
                CROSS JOIN LATERAL public.stock_recipe_requirements(
                    r.item_id,
                    r.quantity * CASE WHEN si.is_sweetener THEN v_factor ELSE 1 END * p_quantity,
                    1
                ) q
                WHERE si.id = r.item_id;
        ELSIF r.linked_id IS NOT NULL THEN
            v_linked_factor := v_factor * public.option_sweetener_factor(r.linked_choice_ids);
            RETURN QUERY
                SELECT q.stock_item_id, q.stock_qty
                FROM public.stock_requirements_for_menu_recipe(
                    r.linked_id, r.quantity * p_quantity, v_linked_factor, p_is_takeaway) q;
            IF COALESCE(p_depth, 0) < 1 THEN
                FOREACH v_fixed IN ARRAY r.linked_choice_ids
                LOOP
                    RETURN QUERY
                        SELECT q.stock_item_id, q.stock_qty
                        FROM public.stock_requirements_for_choice(
                            v_fixed, r.linked_id, r.quantity * p_quantity,
                            v_linked_factor, p_is_takeaway, COALESCE(p_depth, 0) + 1) q;
                END LOOP;
            END IF;
        END IF;
    END LOOP;
END;
$$;

CREATE OR REPLACE FUNCTION public.stock_requirements_for_sale(
    p_menu_item_id BIGINT,
    p_quantity NUMERIC,
    p_options JSONB,
    p_is_takeaway BOOLEAN DEFAULT false
)
RETURNS TABLE (stock_item_id UUID, source TEXT, stock_qty NUMERIC)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    r RECORD;
    v_choice UUID;
    v_choices UUID[] := ARRAY[]::UUID[];
    v_factor NUMERIC := 1;
    v_component_factor NUMERIC;
    v_takeaway BOOLEAN := COALESCE(p_is_takeaway, false);
BEGIN
    IF p_menu_item_id IS NULL OR COALESCE(p_quantity, 0) = 0 THEN
        RETURN;
    END IF;

    -- Chosen option ids (only entries carrying a real choice_id count)
    IF p_options IS NOT NULL AND jsonb_typeof(p_options) = 'array' THEN
        SELECT COALESCE(array_agg(DISTINCT (o->>'choice_id')::uuid), ARRAY[]::UUID[]) INTO v_choices
        FROM jsonb_array_elements(p_options) o
        WHERE jsonb_typeof(o) = 'object'
          AND (o->>'choice_id') ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
    END IF;

    v_factor := public.option_sweetener_factor(v_choices);

    -- 1. The menu's own recipe
    RETURN QUERY
        SELECT q.stock_item_id, 'recipe'::text, q.stock_qty
        FROM public.stock_requirements_for_menu_recipe(p_menu_item_id, p_quantity, v_factor, v_takeaway) q;

    -- 2. A set: the recipe of every menu in it, with the choices the set fixes on each
    FOR r IN
        SELECT c.component_menu_item_id AS component_id,
               c.quantity::numeric AS quantity,
               COALESCE(c.choice_ids, '{}') AS choice_ids
        FROM public.menu_set_components c
        WHERE c.set_menu_item_id = p_menu_item_id
        ORDER BY c.sort_order, c.created_at
    LOOP
        v_component_factor := public.option_sweetener_factor(r.choice_ids);
        RETURN QUERY
            SELECT q.stock_item_id, 'recipe'::text, q.stock_qty
            FROM public.stock_requirements_for_menu_recipe(
                r.component_id, r.quantity * p_quantity, v_component_factor, v_takeaway) q;
        FOREACH v_choice IN ARRAY r.choice_ids
        LOOP
            RETURN QUERY
                SELECT q.stock_item_id, 'recipe'::text, q.stock_qty
                FROM public.stock_requirements_for_choice(
                    v_choice, r.component_id, r.quantity * p_quantity,
                    v_component_factor, v_takeaway, 0) q;
        END LOOP;
    END LOOP;

    -- 3. Options the customer chose
    FOREACH v_choice IN ARRAY v_choices
    LOOP
        RETURN QUERY
            SELECT q.stock_item_id, 'option'::text, q.stock_qty
            FROM public.stock_requirements_for_choice(
                v_choice, p_menu_item_id, p_quantity, v_factor, v_takeaway, 0) q;
    END LOOP;
END;
$$;

REVOKE ALL ON FUNCTION public.option_sweetener_factor(UUID[]) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stock_requirements_for_menu_recipe(BIGINT, NUMERIC, NUMERIC, BOOLEAN) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.stock_requirements_for_choice(UUID, BIGINT, NUMERIC, NUMERIC, BOOLEAN, INT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.option_sweetener_factor(UUID[]) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stock_requirements_for_menu_recipe(BIGINT, NUMERIC, NUMERIC, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.stock_requirements_for_choice(UUID, BIGINT, NUMERIC, NUMERIC, BOOLEAN, INT) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 4. Save the components of one set
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.save_menu_set_components(p_menu_id BIGINT, p_components JSONB)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    item JSONB;
    v_count INT := 0;
    v_choices UUID[];
BEGIN
    PERFORM public.assert_stock_writer();

    DELETE FROM public.menu_set_components WHERE set_menu_item_id = p_menu_id;

    IF p_components IS NOT NULL AND jsonb_typeof(p_components) = 'array' THEN
        FOR item IN SELECT * FROM jsonb_array_elements(p_components)
        LOOP
            SELECT COALESCE(array_agg(x::uuid), '{}') INTO v_choices
            FROM jsonb_array_elements_text(
                     CASE WHEN jsonb_typeof(item->'choice_ids') = 'array'
                          THEN item->'choice_ids' ELSE '[]'::jsonb END) x;

            INSERT INTO public.menu_set_components
                (set_menu_item_id, component_menu_item_id, quantity, choice_ids, sort_order)
            VALUES (
                p_menu_id,
                (item->>'component_menu_item_id')::bigint,
                (item->>'quantity')::numeric,
                v_choices,
                v_count
            );
            v_count := v_count + 1;
        END LOOP;
    END IF;

    RETURN jsonb_build_object('success', true, 'count', v_count);
EXCEPTION WHEN OTHERS THEN
    -- The block is undone as a whole: the components saved before stay as they were.
    RETURN jsonb_build_object('success', false, 'error', SQLERRM);
END;
$$;

REVOKE ALL ON FUNCTION public.save_menu_set_components(BIGINT, JSONB) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_menu_set_components(BIGINT, JSONB) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 5. Recompute: a menu's lines include the sets that contain it
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.recompute_sale_stock_shadow(
    p_from timestamptz,
    p_to timestamptz DEFAULT NULL,
    p_menu_item_id bigint DEFAULT NULL,
    p_dry_run boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
    v_mode TEXT;
    v_from TIMESTAMPTZ;
    v_to TIMESTAMPTZ := COALESCE(p_to, now());
    v_row JSONB;
    v_lines INT := 0;
    v_errors INT := 0;
BEGIN
    PERFORM public.assert_stock_writer();

    IF p_from IS NULL THEN
        RETURN jsonb_build_object('success', false, 'code', 'NO_PERIOD');
    END IF;
    v_from := GREATEST(p_from, now() - interval '62 days');

    SELECT mode INTO v_mode FROM public.stock_deduction_settings WHERE id;
    IF COALESCE(v_mode, 'off') <> 'shadow' THEN
        RETURN jsonb_build_object('success', false, 'code', 'NOT_SHADOW', 'mode', COALESCE(v_mode, 'off'));
    END IF;

    FOR v_row IN
        SELECT to_jsonb(oi)
        FROM public.order_items oi
        WHERE oi.created_at >= v_from
          AND oi.created_at < v_to
          AND (
              p_menu_item_id IS NULL
              OR oi.menu_item_id = p_menu_item_id
              OR EXISTS (
                  SELECT 1 FROM public.menu_set_components c
                  WHERE c.set_menu_item_id = oi.menu_item_id
                    AND c.component_menu_item_id = p_menu_item_id
              )
              OR EXISTS (
                  SELECT 1
                  FROM jsonb_array_elements(
                           CASE WHEN jsonb_typeof(oi.selected_options) = 'array'
                                THEN oi.selected_options ELSE '[]'::jsonb END) o
                  JOIN public.option_choice_ingredients oci ON oci.choice_id::text = o->>'choice_id'
                  WHERE oci.linked_menu_item_id = p_menu_item_id
              )
          )
        ORDER BY oi.id
    LOOP
        v_lines := v_lines + 1;
        IF NOT COALESCE(p_dry_run, false) THEN
            BEGIN
                PERFORM public.record_sale_stock_shadow(
                    (v_row->>'id')::bigint,
                    NULLIF(v_row->>'booking_id', '')::uuid,
                    CASE WHEN COALESCE((v_row->>'is_custom')::boolean, false) THEN NULL
                         ELSE NULLIF(v_row->>'menu_item_id', '')::bigint END,
                    COALESCE(NULLIF(v_row->>'quantity', '')::numeric, 1),
                    v_row->'selected_options',
                    NULLIF(v_row->>'created_at', '')::timestamptz,
                    COALESCE(v_row->>'status', '') IN ('void', 'cancelled'),
                    NULLIF(v_row->>'channel', ''));
            EXCEPTION WHEN OTHERS THEN
                v_errors := v_errors + 1;
                INSERT INTO public.stock_deduction_errors (order_item_id, message)
                VALUES ((v_row->>'id')::bigint, 'recompute: ' || left(SQLERRM, 470));
            END;
        END IF;
    END LOOP;

    RETURN jsonb_build_object(
        'success', true,
        'lines', v_lines,
        'errors', v_errors,
        'from', v_from,
        'to', v_to,
        'dry_run', COALESCE(p_dry_run, false));
END;
$function$;

REVOKE ALL ON FUNCTION public.recompute_sale_stock_shadow(timestamptz, timestamptz, bigint, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.recompute_sale_stock_shadow(timestamptz, timestamptz, bigint, boolean) TO authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 6. Data: the seven sets, as on the menu (same portions as the single dishes)
-- ------------------------------------------------------------------------------
INSERT INTO public.menu_set_components (set_menu_item_id, component_menu_item_id, quantity, choice_ids, sort_order)
SELECT v.set_id, v.component_id, v.quantity, v.choice_ids, v.sort_order
FROM (VALUES
    -- ข้าว + เครื่องดื่ม (the drink is the customer's choice in "จับคู่เครื่องดื่ม")
    (114::bigint,   9::bigint, 1::numeric, '{}'::uuid[], 0),  -- ข้าวหมูตกเตา
    (115,          85,         1,          '{}',         0),  -- ข้าวหมูย่างในบ้าน
    (116,           4,         1,          '{}',         0),  -- ข้าวซอสญี่ปุ่น • หมูซูวี
    -- Set L: ต้มจิ๋ว • คอหมูย่างในบ้าน • ผัดใบเหลียง • ข้าวสวย 1 โถ
    (141,          27,         1,          '{}',         0),
    (141,          25,         1,          '{}',         1),
    (141,         139,         1,          '{}',         2),
    (141,         129,         1,          '{}',         3),
    -- Set XL เซตสำรับในบ้าน: ต้มจิ๋ว • คั่วกลิ้ง • หมูหวานกะปิ • คอหมูย่าง • ผัดใบเหลียง • ข้าวสวย 2 โถ
    (143,          27,         1,          '{}',         0),
    (143,          10,         1,          '{}',         1),
    (143,          95,         1,          '{}',         2),
    (143,          25,         1,          '{}',         3),
    (143,         139,         1,          '{}',         4),
    (143,         129,         2,          '{}',         5),
    -- Set L เซตจริตใต้: สะตอผัดกุ้ง • แกงไตปลา • คั่วกลิ้ง • ข้าวสวย 1 โถ
    (147,         138,         1,          '{}',         0),
    (147,         109,         1,          '{}',         1),
    (147,          10,         1,          '{}',         2),
    (147,         129,         1,          '{}',         3),
    -- Set XL เซตรสชัดใต้: สะตอผัดกุ้ง • แกงไตปลา • คั่วกลิ้ง • หมูหวานกะปิ • ผัดใบเหลียง •
    -- แกงส้มกุ้งหน่อไม้ดอง • ข้าวสวย 2 โถ
    (148,         138,         1,          '{}',         0),
    (148,         109,         1,          '{}',         1),
    (148,          10,         1,          '{}',         2),
    (148,          95,         1,          '{}',         3),
    (148,         139,         1,          '{}',         4),
    (148,          32,         1,          '{bee580b9-e950-4662-bbbe-fc8d7503e292}', 5),  -- หน่อไม้ดอง
    (148,         129,         2,          '{}',         6)
) AS v(set_id, component_id, quantity, choice_ids, sort_order)
WHERE EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = v.set_id)
  AND EXISTS (SELECT 1 FROM public.menu_items mi WHERE mi.id = v.component_id)
  AND NOT EXISTS (SELECT 1 FROM unnest(v.choice_ids) x
                  WHERE NOT EXISTS (SELECT 1 FROM public.option_choices oc WHERE oc.id = x))
ON CONFLICT (set_menu_item_id, component_menu_item_id) DO NOTHING;

-- Set drinks are served iced; the americano uses the house bean (Bolaven).
-- Only rows still without fixed choices are touched.
UPDATE public.option_choice_ingredients oci
SET linked_choice_ids = v.choice_ids
FROM (VALUES
    ('99926459-4727-45d4-8b16-2bf52f48352f'::uuid,  55::bigint,   -- อเมริกาโน่: เย็น + Bolaven
        '{0b345819-92a2-49cc-b8ea-06bda04dc968,db39169a-1ac6-44b7-9056-747026a3a9f5}'::uuid[]),
    ('8bab60a6-dee0-4e60-b989-c9b50c1bbc11',        67,           -- ชาไทย: เย็น
        '{0b345819-92a2-49cc-b8ea-06bda04dc968}'),
    ('bbebe3b6-4858-487a-8cca-0adf9579c146',       127,           -- นมชมพู: เย็น
        '{0b345819-92a2-49cc-b8ea-06bda04dc968}'),
    ('8e26b06a-fdad-46af-908a-0082db362c41',        69,           -- ชามะลิ: เย็น
        '{0b345819-92a2-49cc-b8ea-06bda04dc968}')
) AS v(choice_id, linked_menu_item_id, choice_ids)
WHERE oci.choice_id = v.choice_id
  AND oci.linked_menu_item_id = v.linked_menu_item_id
  AND oci.menu_item_id IS NULL
  AND cardinality(oci.linked_choice_ids) = 0
  AND NOT EXISTS (SELECT 1 FROM unnest(v.choice_ids) x
                  WHERE NOT EXISTS (SELECT 1 FROM public.option_choices oc WHERE oc.id = x));

COMMIT;

NOTIFY pgrst, 'reload schema';
