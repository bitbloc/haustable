-- ==============================================================================
-- Extra barcodes per stock item (scan-to-count)
--
-- stock_items.barcode holds one code per item. Real stock needs more:
-- the same item bought from another brand, or a case that counts as 24.
-- stock_item_barcodes holds those extra codes; units_per_scan is how many
-- counted units one scan adds (a case of 24 bottles = 24).
--
-- A code may not be both an item's main barcode and an extra code; the
-- trigger below keeps the two lists apart. Safe to re-run.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.stock_item_barcodes (
    barcode TEXT PRIMARY KEY CHECK (length(trim(barcode)) > 0),
    stock_item_id UUID NOT NULL REFERENCES public.stock_items(id) ON DELETE CASCADE,
    units_per_scan NUMERIC(14,4) NOT NULL DEFAULT 1 CHECK (units_per_scan > 0),
    note TEXT,
    created_by TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_stock_item_barcodes_item ON public.stock_item_barcodes (stock_item_id);
COMMENT ON TABLE public.stock_item_barcodes IS
  'Extra scan codes for a stock item (other brands, cases). units_per_scan = counted units added per scan.';

CREATE OR REPLACE FUNCTION public.trg_fn_stock_item_barcode_unique()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
    NEW.barcode := trim(NEW.barcode);
    IF EXISTS (SELECT 1 FROM public.stock_items si WHERE si.barcode = NEW.barcode) THEN
        RAISE EXCEPTION 'barcode % already belongs to a stock item', NEW.barcode
            USING ERRCODE = '23505';
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_stock_item_barcode_unique ON public.stock_item_barcodes;
CREATE TRIGGER trg_stock_item_barcode_unique
BEFORE INSERT OR UPDATE OF barcode ON public.stock_item_barcodes
FOR EACH ROW EXECUTE FUNCTION public.trg_fn_stock_item_barcode_unique();

ALTER TABLE public.stock_item_barcodes ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'authenticated') THEN
        RETURN;
    END IF;
    -- Same audience as stock_items: staff who sign in to the stock pages.
    DROP POLICY IF EXISTS stock_item_barcodes_staff ON public.stock_item_barcodes;
    CREATE POLICY stock_item_barcodes_staff ON public.stock_item_barcodes
        FOR ALL TO authenticated USING (true) WITH CHECK (true);
END $$;

NOTIFY pgrst, 'reload schema';
