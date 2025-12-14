-- FIX 1: App Settings Permissions (Fixes "LOADING" issue)
-- Enable RLS to be safe, but allow public read
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can view settings" ON app_settings;
-- Allow everyone (anon + authenticated) to read settings
CREATE POLICY "Public can view settings"
ON app_settings FOR SELECT
USING (true);

-- Allow Admins to update settings
DROP POLICY IF EXISTS "Admins can update settings" ON app_settings;
CREATE POLICY "Admins can update settings"
ON app_settings FOR UPDATE
USING (is_admin());


-- FIX 2: Re-apply Profile Permissions (Fixes "Member" vs "Admin" issue)
-- Ensure the function is definitely secure and accessible
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO service_role;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon; -- Just in case

-- Double check Profile Read Policy
DROP POLICY IF EXISTS "Users can view own profile" ON profiles;
CREATE POLICY "Users can view own profile"
ON profiles FOR SELECT
USING (auth.uid() = id);

-- Ensure Admins can definitely see everything
DROP POLICY IF EXISTS "Admins can view all profiles" ON profiles;
CREATE POLICY "Admins can view all profiles"
ON profiles FOR SELECT
USING (is_admin());
