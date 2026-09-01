-- Migration: Add admin_permissions column to profiles and support custom role in POS & backoffice
-- Date: 2026-09-01

-- 1. Add admin_permissions column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS admin_permissions TEXT[] DEFAULT '{}'::TEXT[];

-- 2. Update verify_staff_pin_login to include custom role and any profiles with admin_permissions
CREATE OR REPLACE FUNCTION public.verify_staff_pin_login(p_pin text)
RETURNS TABLE (id UUID, display_name TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.profiles p
    WHERE p.pin = p_pin 
      AND (
        p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin', 'custom')
        OR (p.admin_permissions IS NOT NULL AND cardinality(p.admin_permissions) > 0)
      )
    LIMIT 1;
END;
$$;

-- 3. Update get_staff_list_safe to include custom role
CREATE OR REPLACE FUNCTION public.get_staff_list_safe()
RETURNS TABLE (id UUID, display_name TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.profiles p
    WHERE (
        p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin', 'custom')
        OR (p.admin_permissions IS NOT NULL AND cardinality(p.admin_permissions) > 0)
    )
    ORDER BY p.role DESC, p.display_name ASC;
END;
$$;
