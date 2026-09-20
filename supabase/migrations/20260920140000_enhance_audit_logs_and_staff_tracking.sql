-- ==============================================================================
-- Migration: Enhance Staff & POS Audit Logs with Module Tracking & Indexes
-- Date: 2026-09-20
-- Purpose: Support high-resolution staff activity tracking (Stock adjustments,
--          POS table moves, Merged bills, Shift cash flow, and Backoffice actions)
-- ==============================================================================

-- 1. Ensure module column exists
ALTER TABLE public.pos_audit_logs 
ADD COLUMN IF NOT EXISTS module TEXT DEFAULT 'pos';

-- 2. Indexes for fast filtering and 7-day observability
CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_module_created 
ON public.pos_audit_logs (module, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_staff_name 
ON public.pos_audit_logs (staff_name, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pos_audit_logs_action_type 
ON public.pos_audit_logs (action_type, created_at DESC);

-- 3. Update log_pos_audit_event RPC to optionally accept p_module
CREATE OR REPLACE FUNCTION public.log_pos_audit_event(
    p_shift_id TEXT,
    p_staff_name TEXT,
    p_action_type TEXT,
    p_booking_id UUID DEFAULT NULL,
    p_amount NUMERIC DEFAULT 0.00,
    p_reason TEXT DEFAULT NULL,
    p_metadata JSONB DEFAULT '{}'::jsonb,
    p_staff_id UUID DEFAULT NULL,
    p_module TEXT DEFAULT 'pos'
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_log_id UUID;
    v_resolved_module TEXT;
BEGIN
    -- Extract module from metadata if provided, or use p_module
    v_resolved_module := COALESCE(p_metadata->>'module', p_module, 'pos');

    INSERT INTO public.pos_audit_logs (
        shift_id, staff_name, action_type, booking_id, amount, reason, metadata, staff_id, module
    ) VALUES (
        p_shift_id, p_staff_name, p_action_type, p_booking_id, p_amount, p_reason, p_metadata, p_staff_id, v_resolved_module
    ) RETURNING id INTO v_log_id;
    
    RETURN v_log_id;
END;
$$;

-- 4. Reload PostgREST schema cache
NOTIFY pgrst, 'reload schema';
