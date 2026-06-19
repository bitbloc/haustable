-- 1. Enable RLS on menu_items table
ALTER TABLE public.menu_items ENABLE ROW LEVEL SECURITY;

-- 2. Drop existing policies to prevent conflicts/duplicates
DROP POLICY IF EXISTS "Public read menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Allow select for public" ON public.menu_items;
DROP POLICY IF EXISTS "Allow read access for all users" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can insert menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can update menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Admins can delete menu_items" ON public.menu_items;
DROP POLICY IF EXISTS "Enable all access for authenticated users" ON public.menu_items;
DROP POLICY IF EXISTS "Enable all access for public" ON public.menu_items;

-- 3. Create Policy: Public can view/select menu items (required for customers to see the menu)
CREATE POLICY "Public read menu_items"
ON public.menu_items FOR SELECT
USING (true);

-- 4. Create Policies: Admins can do everything (insert, update, delete)
CREATE POLICY "Admins can insert menu_items"
ON public.menu_items FOR INSERT
TO authenticated
WITH CHECK (is_admin());

CREATE POLICY "Admins can update menu_items"
ON public.menu_items FOR UPDATE
TO authenticated
USING (is_admin())
WITH CHECK (is_admin());

CREATE POLICY "Admins can delete menu_items"
ON public.menu_items FOR DELETE
TO authenticated
USING (is_admin());

-- Optional Fallback: If is_admin() function fails or isn't set up, uncomment this to allow any authenticated staff/users
-- CREATE POLICY "Authenticated users can manage menu_items" ON public.menu_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
