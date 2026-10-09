-- Migration: Fix Menu Items & Backoffice RBAC Permissions (is_admin & can_manage_menu)
-- Date: 2026-10-09
-- Purpose:
--   Allow staff/admins who have role 'owner', 'manager', 'kitchen', or custom 'menu' in admin_permissions
--   to successfully update/insert/delete menu_items and categories, preventing silent RLS update failures.

-- ==============================================================================
-- 1. Helper function: is_admin() (Supports owner, admin, or wildcard '*' permission)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND (
            LOWER(COALESCE(role, '')) IN ('admin', 'owner')
            OR '*' = ANY(COALESCE(admin_permissions, '{}'::text[]))
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ==============================================================================
-- 2. Helper function: can_manage_menu() (Supports admin, owner, manager, kitchen, or 'menu'/'*' permission)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.can_manage_menu()
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() 
          AND (
            LOWER(COALESCE(role, '')) IN ('admin', 'owner', 'manager', 'kitchen')
            OR '*' = ANY(COALESCE(admin_permissions, '{}'::text[]))
            OR 'menu' = ANY(COALESCE(admin_permissions, '{}'::text[]))
          )
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated, anon, service_role;
GRANT EXECUTE ON FUNCTION public.can_manage_menu() TO authenticated, anon, service_role;

-- ==============================================================================
-- 3. Row Level Security on public.menu_items
-- ==============================================================================
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- 3.1 Public SELECT (Customers & Staff can view menu items)
DROP POLICY IF EXISTS "Public read menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow select for public" ON public.menu_items;
DROP POLICY IF EXISTS "Allow read access for all users" ON public.menu_items;
CREATE POLICY "Public read menu_items"
ON public.menu_items FOR SELECT
USING (true);

-- 3.2 INSERT for authorized menu managers
DROP POLICY IF EXISTS "Admins can insert menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Staff can insert menu_items" ON public.menu_items;
CREATE POLICY "Admins can insert menu_items"
ON public.menu_items FOR INSERT
TO authenticated
WITH CHECK (public.can_manage_menu() OR public.is_admin());

-- 3.3 UPDATE for authorized menu managers
DROP POLICY IF EXISTS "Admins can update menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Staff can update menu_items" ON public.menu_items;
CREATE POLICY "Admins can update menu_items"
ON public.menu_items FOR UPDATE
TO authenticated
USING (public.can_manage_menu() OR public.is_admin())
WITH CHECK (public.can_manage_menu() OR public.is_admin());

-- 3.4 DELETE for authorized menu managers
DROP POLICY IF EXISTS "Admins can delete menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Staff can delete menu_items" ON public.menu_items;
CREATE POLICY "Admins can delete menu_items"
ON public.menu_items FOR DELETE
TO authenticated
USING (public.can_manage_menu() OR public.is_admin());

-- ==============================================================================
-- 4. Row Level Security on related menu tables
-- ==============================================================================

-- 4.1 menu_categories
ALTER TABLE public.menu_categories ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read categories" ON public.menu_categories;
CREATE POLICY "Public read categories" ON public.menu_categories FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all for users" ON public.menu_categories;
DROP POLICY IF EXISTS "Allow menu managers to modify categories" ON public.menu_categories;
CREATE POLICY "Allow menu managers to modify categories"
ON public.menu_categories FOR ALL
TO authenticated
USING (public.can_manage_menu() OR public.is_admin())
WITH CHECK (public.can_manage_menu() OR public.is_admin());

-- 4.2 menu_item_options
ALTER TABLE public.menu_item_options ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read menu item options" ON public.menu_item_options;
CREATE POLICY "Public read menu item options" ON public.menu_item_options FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all for users" ON public.menu_item_options;
DROP POLICY IF EXISTS "Allow menu managers to modify menu_item_options" ON public.menu_item_options;
CREATE POLICY "Allow menu managers to modify menu_item_options"
ON public.menu_item_options FOR ALL
TO authenticated
USING (public.can_manage_menu() OR public.is_admin())
WITH CHECK (public.can_manage_menu() OR public.is_admin());

-- 4.3 option_groups
ALTER TABLE public.option_groups ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read option groups" ON public.option_groups;
CREATE POLICY "Public read option groups" ON public.option_groups FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all for users" ON public.option_groups;
DROP POLICY IF EXISTS "Allow menu managers to modify option_groups" ON public.option_groups;
CREATE POLICY "Allow menu managers to modify option_groups"
ON public.option_groups FOR ALL
TO authenticated
USING (public.can_manage_menu() OR public.is_admin())
WITH CHECK (public.can_manage_menu() OR public.is_admin());

-- 4.4 option_choices
ALTER TABLE public.option_choices ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Public read option choices" ON public.option_choices;
CREATE POLICY "Public read option choices" ON public.option_choices FOR SELECT USING (true);

DROP POLICY IF EXISTS "Enable all for users" ON public.option_choices;
DROP POLICY IF EXISTS "Allow menu managers to modify option_choices" ON public.option_choices;
CREATE POLICY "Allow menu managers to modify option_choices"
ON public.option_choices FOR ALL
TO authenticated
USING (public.can_manage_menu() OR public.is_admin())
WITH CHECK (public.can_manage_menu() OR public.is_admin());

-- ==============================================================================
-- 5. Force PostgREST schema cache reload
-- ==============================================================================
NOTIFY pgrst, 'reload schema';
