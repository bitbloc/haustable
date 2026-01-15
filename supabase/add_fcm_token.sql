-- Add fcm_token column to profiles table if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'fcm_token') then 
    alter table profiles add column fcm_token text; 
  end if; 
end $$;

-- Optional: Create an index for performance if querying by token often (though usually we query by user_id)
-- create index if not exists idx_profiles_fcm_token on profiles(fcm_token);
