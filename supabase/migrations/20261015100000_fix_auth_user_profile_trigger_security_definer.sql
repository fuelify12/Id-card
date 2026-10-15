-- Auth user creation runs through Supabase's auth service role. The profile trigger
-- must bypass profiles RLS safely, otherwise signup can fail while inserting auth.users.
-- SECURITY DEFINER is narrowly scoped, uses an empty search_path, and fully qualifies
-- the only table reference. End-user roles cannot invoke this function directly.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
BEGIN
  INSERT INTO public.profiles (id, full_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data ->> 'full_name', ''));
  RETURN NEW;
END;
$function$;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM anon, authenticated;
