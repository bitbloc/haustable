-- Migration: Allow all staff roles (staff, cashier, kitchen, manager, owner, admin) in POS PIN login RPCs
-- Date: 2026-08-23

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
      AND p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin')
    LIMIT 1;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_staff_list_safe()
RETURNS TABLE (id UUID, display_name TEXT, role TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.role
    FROM public.profiles p
    WHERE p.role IN ('staff', 'cashier', 'kitchen', 'manager', 'owner', 'admin')
    ORDER BY p.role DESC, p.display_name ASC;
END;
$$;
