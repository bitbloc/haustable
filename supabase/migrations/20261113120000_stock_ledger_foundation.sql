-- ==============================================================================
-- Migration: Stock ledger foundation (Stock roadmap · Phase 0)
-- Date: 2026-11-13
--
-- Goal: every change to stock_items.current_quantity leaves exactly one ledger row
-- carrying the signed change and the balance after it, so that
--     SUM(stock_transactions.quantity_change) = stock_items.current_quantity
-- holds for every item, and the balance at any past moment can be read back.
--
-- What it does
--   1. Baseline: creates the stock/recipe tables if they are missing (they were only
--      ever created from loose SQL files outside migrations). No-op on the live DB.
--   2. Adds ledger columns to stock_transactions and converts quantities to NUMERIC.
--   3. post_stock_movement(): the single entry point for changing a quantity.
--   4. Compatibility triggers so app builds already installed on devices (which insert
--      into stock_transactions or update stock_items directly) still produce a
--      correct ledger.
--   5. Rewrites set_stock_quantity / update_stock_quantity as thin wrappers.
--   6. Opening rows so the ledger matches today's quantities.
--   7. deduct_order_stock / restore_order_stock no longer turn "untracked" (NULL)
--      menu stock into a number.
--
-- Not touched: RLS and grants on stock_* (owned by supabase/security_hardening).
-- Safe to re-run.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Baseline tables (fresh databases only)
-- ------------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.stock_categories (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    icon TEXT NOT NULL DEFAULT '',
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    image_url TEXT,
    current_quantity NUMERIC(14,4) DEFAULT 0,
    unit TEXT NOT NULL,
    base_unit TEXT,
    unit_config JSONB DEFAULT '{}'::jsonb,
    barcode TEXT UNIQUE,
    display_order INTEGER DEFAULT 0,
    min_stock_threshold FLOAT DEFAULT 0,
    reorder_point FLOAT DEFAULT 0,
    par_level FLOAT DEFAULT 0,
    cost_price FLOAT DEFAULT 0,
    pack_size FLOAT DEFAULT 1,
    pack_unit TEXT DEFAULT 'unit',
    usage_unit TEXT DEFAULT 'unit',
    conversion_factor FLOAT DEFAULT 1,
    yield_percent FLOAT DEFAULT 100,
    is_base_recipe BOOLEAN DEFAULT false,
    capacity_per_unit FLOAT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.stock_transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE,
    transaction_type TEXT NOT NULL,
    quantity_change NUMERIC(14,4) NOT NULL,
    performed_by TEXT,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

DO $$
BEGIN
    IF to_regclass('public.menu_items') IS NOT NULL AND to_regclass('public.recipe_ingredients') IS NULL THEN
        CREATE TABLE public.recipe_ingredients (
            id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
            created_at TIMESTAMPTZ DEFAULT now(),
            parent_menu_item_id BIGINT REFERENCES public.menu_items(id) ON DELETE CASCADE,
            parent_stock_item_id UUID REFERENCES public.stock_items(id) ON DELETE CASCADE,
            ingredient_id UUID REFERENCES public.stock_items(id) ON DELETE RESTRICT,
            quantity FLOAT NOT NULL,
            unit TEXT,
            layer_order INT DEFAULT 0,
            CONSTRAINT one_parent_check CHECK (
                (parent_menu_item_id IS NOT NULL AND parent_stock_item_id IS NULL) OR
                (parent_menu_item_id IS NULL AND parent_stock_item_id IS NOT NULL)
            )
        );
        CREATE INDEX idx_recipe_menu_parent ON public.recipe_ingredients(parent_menu_item_id);
        CREATE INDEX idx_recipe_stock_parent ON public.recipe_ingredients(parent_stock_item_id);
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 2. Ledger columns
-- ------------------------------------------------------------------------------
ALTER TABLE public.stock_transactions
    ADD COLUMN IF NOT EXISTS balance_after NUMERIC(14,4),
    ADD COLUMN IF NOT EXISTS reason TEXT,
    ADD COLUMN IF NOT EXISTS ref_type TEXT,
    ADD COLUMN IF NOT EXISTS ref_id TEXT,
    ADD COLUMN IF NOT EXISTS shift_id TEXT,
    ADD COLUMN IF NOT EXISTS unit_cost NUMERIC(14,4),
    ADD COLUMN IF NOT EXISTS occurred_at TIMESTAMPTZ;

COMMENT ON COLUMN public.stock_transactions.balance_after IS 'stock_items.current_quantity right after this row was applied';
COMMENT ON COLUMN public.stock_transactions.reason IS 'opening | purchase | sale | sale_void | waste | staff_meal | production_in | production_out | transfer | count_adjust | adjust';
COMMENT ON COLUMN public.stock_transactions.ref_type IS 'What caused the movement, e.g. order_item, expense, count_session, production';
COMMENT ON COLUMN public.stock_transactions.occurred_at IS 'When it happened in the shop (differs from created_at for offline sync)';

-- FLOAT -> NUMERIC so sums reconcile exactly. Skipped (with a notice) if something
-- in the live database depends on the column type; the ledger works either way.
DO $$
BEGIN
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stock_items' AND column_name = 'current_quantity') <> 'numeric' THEN
        ALTER TABLE public.stock_items
            ALTER COLUMN current_quantity TYPE NUMERIC(14,4) USING round(current_quantity::numeric, 4);
    END IF;
    IF (SELECT data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'stock_transactions' AND column_name = 'quantity_change') <> 'numeric' THEN
        ALTER TABLE public.stock_transactions
            ALTER COLUMN quantity_change TYPE NUMERIC(14,4) USING round(quantity_change::numeric, 4);
    END IF;
EXCEPTION WHEN OTHERS THEN
    RAISE NOTICE 'stock quantity columns left as-is (%). Ledger still works.', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS idx_stock_tx_item_created ON public.stock_transactions (stock_item_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_stock_tx_reason_created ON public.stock_transactions (reason, created_at DESC);
-- One ledger row per (cause, item): makes automatic deductions safe to retry.
CREATE UNIQUE INDEX IF NOT EXISTS uq_stock_tx_ref
    ON public.stock_transactions (ref_type, ref_id, stock_item_id, reason)
    WHERE ref_type IS NOT NULL AND ref_id IS NOT NULL;

-- ------------------------------------------------------------------------------
-- 3. The single entry point
-- ------------------------------------------------------------------------------
-- p_mode 'delta': p_quantity is a signed change.  p_mode 'set': p_quantity is the counted total.
-- Negative balances are allowed on purpose: selling must never be blocked by stock data.
CREATE OR REPLACE FUNCTION public.post_stock_movement(
    p_item_id UUID,
    p_mode TEXT,
    p_quantity NUMERIC,
    p_reason TEXT DEFAULT NULL,
    p_performed_by TEXT DEFAULT 'Staff',
    p_note TEXT DEFAULT NULL,
    p_ref_type TEXT DEFAULT NULL,
    p_ref_id TEXT DEFAULT NULL,
    p_shift_id TEXT DEFAULT NULL,
    p_occurred_at TIMESTAMPTZ DEFAULT NULL
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old NUMERIC;
    v_new NUMERIC;
    v_delta NUMERIC;
    v_type TEXT;
    v_reason TEXT;
    v_tx_id UUID;
BEGIN
    IF p_mode NOT IN ('delta', 'set') THEN
        RAISE EXCEPTION 'post_stock_movement: p_mode must be delta or set, got %', p_mode;
    END IF;
    IF p_quantity IS NULL THEN
        RAISE EXCEPTION 'post_stock_movement: p_quantity is required';
    END IF;

    -- Retry of an automatic movement that was already posted: return it unchanged.
    IF p_ref_type IS NOT NULL AND p_ref_id IS NOT NULL THEN
        SELECT id, balance_after, quantity_change INTO v_tx_id, v_new, v_delta
        FROM public.stock_transactions
        WHERE ref_type = p_ref_type AND ref_id = p_ref_id AND stock_item_id = p_item_id
          AND reason = COALESCE(p_reason, CASE WHEN p_mode = 'set' THEN 'count_adjust' ELSE 'adjust' END);
        IF FOUND THEN
            RETURN jsonb_build_object('success', true, 'duplicate', true, 'transaction_id', v_tx_id,
                                      'new_quantity', v_new, 'quantity_change', v_delta);
        END IF;
    END IF;

    SELECT COALESCE(current_quantity, 0)::numeric INTO v_old
    FROM public.stock_items WHERE id = p_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RAISE EXCEPTION 'post_stock_movement: stock item % not found', p_item_id;
    END IF;

    IF p_mode = 'set' THEN
        v_new := round(p_quantity, 4);
        v_delta := v_new - v_old;
        v_type := 'set';
        v_reason := COALESCE(p_reason, 'count_adjust');
    ELSE
        v_delta := round(p_quantity, 4);
        v_new := v_old + v_delta;
        v_type := CASE WHEN v_delta >= 0 THEN 'in' ELSE 'out' END;
        v_reason := COALESCE(p_reason, 'adjust');
    END IF;

    IF v_reason NOT IN ('opening', 'purchase', 'sale', 'sale_void', 'waste', 'staff_meal',
                        'production_in', 'production_out', 'transfer', 'count_adjust', 'adjust') THEN
        RAISE EXCEPTION 'post_stock_movement: unknown reason %', v_reason;
    END IF;

    -- Tell the compatibility triggers this change is already being recorded here.
    PERFORM set_config('stock.ledger_writer', '1', true);

    UPDATE public.stock_items
    SET current_quantity = v_new, updated_at = now()
    WHERE id = p_item_id;

    INSERT INTO public.stock_transactions
        (stock_item_id, transaction_type, quantity_change, balance_after, reason,
         performed_by, note, ref_type, ref_id, shift_id, occurred_at)
    VALUES
        (p_item_id, v_type, v_delta, v_new, v_reason,
         COALESCE(p_performed_by, 'Staff'), p_note, p_ref_type, p_ref_id, p_shift_id, COALESCE(p_occurred_at, now()))
    RETURNING id INTO v_tx_id;

    PERFORM set_config('stock.ledger_writer', '', true);

    RETURN jsonb_build_object('success', true, 'transaction_id', v_tx_id,
                              'old_quantity', v_old, 'new_quantity', v_new, 'quantity_change', v_delta);
END;
$$;

-- ------------------------------------------------------------------------------
-- 4. Compatibility triggers (older app builds, edge functions, manual SQL)
-- ------------------------------------------------------------------------------
-- 4a. A row inserted straight into stock_transactions.
--     in / out / audit : apply the signed change (audit used to be skipped, which lost
--                        the initial quantity of newly created items).
--     set              : the old client already wrote the new total itself; just stamp it.
CREATE OR REPLACE FUNCTION public.handle_stock_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old NUMERIC;
BEGIN
    IF COALESCE(current_setting('stock.ledger_writer', true), '') = '1' THEN
        RETURN NEW;
    END IF;

    NEW.occurred_at := COALESCE(NEW.occurred_at, NEW.created_at, now());

    SELECT COALESCE(current_quantity, 0)::numeric INTO v_old
    FROM public.stock_items WHERE id = NEW.stock_item_id FOR UPDATE;
    IF NOT FOUND THEN
        RETURN NEW;
    END IF;

    IF NEW.transaction_type = 'set' THEN
        -- The quantity itself was (or was not) changed by a direct update, which
        -- trigger 4b records. Counting this row's own number too would double it.
        IF COALESCE(NEW.quantity_change, 0) <> 0 THEN
            NEW.note := concat_ws(' | ', NEW.note, 'Δ' || NEW.quantity_change);
            NEW.quantity_change := 0;
        END IF;
        NEW.balance_after := v_old;
        NEW.reason := COALESCE(NEW.reason, 'count_adjust');
        RETURN NEW;
    END IF;

    NEW.balance_after := v_old + COALESCE(NEW.quantity_change, 0);
    NEW.reason := COALESCE(NEW.reason, CASE WHEN NEW.transaction_type = 'audit' THEN 'opening' ELSE 'adjust' END);

    PERFORM set_config('stock.ledger_writer', '1', true);
    UPDATE public.stock_items
    SET current_quantity = NEW.balance_after, updated_at = now()
    WHERE id = NEW.stock_item_id;
    PERFORM set_config('stock.ledger_writer', '', true);

    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_transaction_sync ON public.stock_transactions;
DROP TRIGGER IF EXISTS trg_stock_transaction_sync_v2 ON public.stock_transactions;
DROP TRIGGER IF EXISTS stock_transaction_trigger ON public.stock_transactions;
DROP TRIGGER IF EXISTS handle_stock_transaction_trigger ON public.stock_transactions;

CREATE TRIGGER trg_stock_transaction_sync
BEFORE INSERT ON public.stock_transactions
FOR EACH ROW
EXECUTE FUNCTION public.handle_stock_transaction();

-- 4b. current_quantity written directly on stock_items (old count screen, data purge,
--     SQL editor). Record the difference so the ledger never falls behind.
CREATE OR REPLACE FUNCTION public.log_direct_stock_quantity_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_old NUMERIC := 0;
    v_new NUMERIC := COALESCE(NEW.current_quantity, 0)::numeric;
BEGIN
    IF COALESCE(current_setting('stock.ledger_writer', true), '') = '1' THEN
        RETURN NEW;
    END IF;
    IF TG_OP = 'UPDATE' THEN
        v_old := COALESCE(OLD.current_quantity, 0)::numeric;
    END IF;
    IF v_new = v_old THEN
        RETURN NEW;
    END IF;

    PERFORM set_config('stock.ledger_writer', '1', true);
    INSERT INTO public.stock_transactions
        (stock_item_id, transaction_type, quantity_change, balance_after, reason, performed_by, note, occurred_at)
    VALUES
        (NEW.id, 'set', v_new - v_old, v_new,
         CASE WHEN TG_OP = 'INSERT' THEN 'opening' ELSE 'count_adjust' END,
         'System',
         CASE WHEN TG_OP = 'INSERT' THEN 'ยอดเริ่มต้นตอนสร้างรายการ' ELSE 'แก้ยอดโดยตรง (ไม่ผ่าน post_stock_movement)' END,
         now());
    PERFORM set_config('stock.ledger_writer', '', true);
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_items_direct_qty ON public.stock_items;
CREATE TRIGGER trg_stock_items_direct_qty
AFTER INSERT OR UPDATE OF current_quantity ON public.stock_items
FOR EACH ROW
EXECUTE FUNCTION public.log_direct_stock_quantity_change();

-- 4c. Re-baseline: add an opening row wherever the ledger total differs from the
--     quantity on hand. Used once below and after ledger rows are deleted (data purge).
CREATE OR REPLACE FUNCTION public.stock_rebaseline_ledger()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    v_count INTEGER;
BEGIN
    PERFORM set_config('stock.ledger_writer', '1', true);
    WITH gap AS (
        SELECT si.id,
               COALESCE(si.current_quantity, 0)::numeric AS qty,
               COALESCE(si.current_quantity, 0)::numeric
                 - COALESCE((SELECT SUM(st.quantity_change) FROM public.stock_transactions st
                             WHERE st.stock_item_id = si.id), 0)::numeric AS diff
        FROM public.stock_items si
    ), ins AS (
        INSERT INTO public.stock_transactions
            (stock_item_id, transaction_type, quantity_change, balance_after, reason, performed_by, note, occurred_at)
        SELECT id, 'set', diff, qty, 'opening', 'System', 'ยอดยกมา (ตั้งต้น ledger)', now()
        FROM gap WHERE round(diff, 4) <> 0
        RETURNING 1
    )
    SELECT COUNT(*) INTO v_count FROM ins;
    PERFORM set_config('stock.ledger_writer', '', true);
    RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.trg_fn_stock_tx_rebaseline()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.stock_rebaseline_ledger();
    RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_tx_rebaseline ON public.stock_transactions;
CREATE TRIGGER trg_stock_tx_rebaseline
AFTER DELETE ON public.stock_transactions
FOR EACH STATEMENT
EXECUTE FUNCTION public.trg_fn_stock_tx_rebaseline();

-- ------------------------------------------------------------------------------
-- 5. Existing RPCs become wrappers
-- ------------------------------------------------------------------------------
-- Older overloads wrote the quantity and a ledger row separately.
DROP FUNCTION IF EXISTS public.set_stock_quantity(UUID, FLOAT, TEXT);
DROP FUNCTION IF EXISTS public.set_stock_quantity(UUID, FLOAT);

CREATE OR REPLACE FUNCTION public.set_stock_quantity(
    p_item_id UUID,
    p_new_quantity FLOAT,
    p_reason TEXT DEFAULT 'Audit',
    p_performed_by TEXT DEFAULT 'Staff'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.post_stock_movement(p_item_id, 'set', p_new_quantity::numeric, 'count_adjust', p_performed_by, p_reason);
END;
$$;

-- The two-argument version changed the quantity without writing a ledger row.
DROP FUNCTION IF EXISTS public.update_stock_quantity(UUID, FLOAT);

CREATE OR REPLACE FUNCTION public.update_stock_quantity(
    p_item_id UUID,
    p_quantity_change FLOAT,
    p_performed_by TEXT DEFAULT 'Staff',
    p_note TEXT DEFAULT 'Adjustment'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    PERFORM public.post_stock_movement(p_item_id, 'delta', p_quantity_change::numeric, 'adjust', p_performed_by, p_note);
END;
$$;

-- ------------------------------------------------------------------------------
-- 6. Read helpers
-- ------------------------------------------------------------------------------
-- Any row here with diff <> 0 means something bypassed the ledger.
CREATE OR REPLACE VIEW public.stock_ledger_check WITH (security_invoker = true) AS
SELECT si.id,
       si.name,
       COALESCE(si.current_quantity, 0)::numeric AS current_quantity,
       COALESCE(SUM(st.quantity_change), 0)::numeric AS ledger_total,
       round(COALESCE(si.current_quantity, 0)::numeric - COALESCE(SUM(st.quantity_change), 0)::numeric, 4) AS diff
FROM public.stock_items si
LEFT JOIN public.stock_transactions st ON st.stock_item_id = si.id
GROUP BY si.id, si.name, si.current_quantity;

-- Quantity on hand for every item at a past moment ("how much was there at 10:00?").
CREATE OR REPLACE FUNCTION public.stock_balance_at(p_at TIMESTAMPTZ)
RETURNS TABLE (stock_item_id UUID, quantity NUMERIC)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
    SELECT si.id,
           COALESCE((SELECT SUM(st.quantity_change) FROM public.stock_transactions st
                     WHERE st.stock_item_id = si.id AND st.created_at <= p_at), 0)::numeric
    FROM public.stock_items si;
$$;

-- Stock screens are used by signed-in staff. Automatic deductions will run inside
-- database triggers, so the public (anon) role needs none of these.
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'anon')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated')
       AND EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'service_role') THEN
        REVOKE ALL ON FUNCTION public.post_stock_movement(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.post_stock_movement(UUID, TEXT, NUMERIC, TEXT, TEXT, TEXT, TEXT, TEXT, TEXT, TIMESTAMPTZ) TO authenticated, service_role;
        REVOKE ALL ON FUNCTION public.stock_balance_at(TIMESTAMPTZ) FROM PUBLIC, anon;
        GRANT EXECUTE ON FUNCTION public.stock_balance_at(TIMESTAMPTZ) TO authenticated, service_role;
        REVOKE ALL ON FUNCTION public.stock_rebaseline_ledger() FROM PUBLIC, anon, authenticated;
        GRANT EXECUTE ON FUNCTION public.stock_rebaseline_ledger() TO service_role;
        REVOKE ALL ON public.stock_ledger_check FROM anon;
        GRANT SELECT ON public.stock_ledger_check TO authenticated, service_role;
    END IF;
END $$;

-- ------------------------------------------------------------------------------
-- 7. Opening rows for today's quantities
-- ------------------------------------------------------------------------------
SELECT public.stock_rebaseline_ledger();

UPDATE public.stock_transactions
SET occurred_at = created_at
WHERE occurred_at IS NULL;

-- ------------------------------------------------------------------------------
-- 8. HAUSMADE menu stock: leave untracked (NULL) items untracked
-- ------------------------------------------------------------------------------
DO $$
BEGIN
    IF to_regclass('public.menu_items') IS NULL OR to_regclass('public.order_items') IS NULL
       OR NOT EXISTS (SELECT 1 FROM information_schema.columns
                      WHERE table_schema = 'public' AND table_name = 'menu_items' AND column_name = 'remaining_stock') THEN
        RAISE NOTICE 'menu stock columns not present; skipping deduct/restore_order_stock fix';
        RETURN;
    END IF;

    EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.deduct_order_stock(p_booking_id UUID)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
        item RECORD;
        deducted_count INT := 0;
    BEGIN
        FOR item IN
            SELECT menu_item_id, quantity FROM public.order_items
            WHERE booking_id = p_booking_id AND menu_item_id IS NOT NULL
        LOOP
            UPDATE public.menu_items
            SET remaining_stock = GREATEST(0, COALESCE(remaining_stock, stock_quantity) - item.quantity),
                stock_quantity = GREATEST(0, COALESCE(stock_quantity, remaining_stock) - item.quantity)
            WHERE id = item.menu_item_id
              AND (stock_quantity IS NOT NULL OR remaining_stock IS NOT NULL);
            IF FOUND THEN
                deducted_count := deducted_count + 1;
            END IF;
        END LOOP;
        RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'items_deducted', deducted_count);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
    $body$;
    $fn$;

    EXECUTE $fn$
    CREATE OR REPLACE FUNCTION public.restore_order_stock(p_booking_id UUID)
    RETURNS JSONB
    LANGUAGE plpgsql
    SECURITY DEFINER
    SET search_path = public
    AS $body$
    DECLARE
        item RECORD;
        restored_count INT := 0;
    BEGIN
        FOR item IN
            SELECT menu_item_id, quantity FROM public.order_items
            WHERE booking_id = p_booking_id AND menu_item_id IS NOT NULL
        LOOP
            UPDATE public.menu_items
            SET remaining_stock = COALESCE(remaining_stock, stock_quantity) + item.quantity,
                stock_quantity = COALESCE(stock_quantity, remaining_stock) + item.quantity
            WHERE id = item.menu_item_id
              AND (stock_quantity IS NOT NULL OR remaining_stock IS NOT NULL);
            IF FOUND THEN
                restored_count := restored_count + 1;
            END IF;
        END LOOP;
        RETURN jsonb_build_object('success', true, 'booking_id', p_booking_id, 'items_restored', restored_count);
    EXCEPTION WHEN OTHERS THEN
        RETURN jsonb_build_object('success', false, 'error', SQLERRM);
    END;
    $body$;
    $fn$;
END $$;

NOTIFY pgrst, 'reload schema';
