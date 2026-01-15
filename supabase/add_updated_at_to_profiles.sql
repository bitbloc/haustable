-- Add updated_at column to profiles table if it doesn't exist
do $$ 
begin 
  if not exists (select 1 from information_schema.columns where table_name = 'profiles' and column_name = 'updated_at') then 
    alter table profiles add column updated_at timestamptz default now(); 
  end if; 
end $$;
