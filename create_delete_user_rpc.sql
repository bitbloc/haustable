create or replace function delete_user_by_admin(target_user_id uuid)
returns void
security definer
language plpgsql
as $$
begin
  -- Delete profile first to be safe (if no cascade)
  delete from public.profiles where id = target_user_id;
  
  -- Delete auth user
  delete from auth.users where id = target_user_id;
end;
$$;
