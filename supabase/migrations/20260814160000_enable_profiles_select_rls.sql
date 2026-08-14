-- Enable SELECT read on profiles so POS and Reports can view customer names, points, and tiers
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_select_all" ON public.profiles;
DROP POLICY IF EXISTS "profiles_read_all" ON public.profiles;
DROP POLICY IF EXISTS "Allow select profiles for all" ON public.profiles;
DROP POLICY IF EXISTS "Public profiles are viewable by everyone" ON public.profiles;
DROP POLICY IF EXISTS "Enable read access for all users" ON public.profiles;

CREATE POLICY "profiles_select_all" ON public.profiles
FOR SELECT
USING (true);

-- Also ensure find_profile_by_name is created
CREATE OR REPLACE FUNCTION public.find_profile_by_name(p_name TEXT)
RETURNS TABLE (id UUID, display_name TEXT, nickname TEXT, phone_number TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    RETURN QUERY
    SELECT p.id, p.display_name, p.nickname, p.phone_number
    FROM public.profiles p
    WHERE p.display_name ILIKE '%' || p_name || '%'
       OR p.nickname ILIKE '%' || p_name || '%';
END;
$$;
