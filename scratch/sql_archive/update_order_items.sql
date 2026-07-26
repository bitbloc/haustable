-- Add selected_options column to order_items to store customization details
do $$ 
begin
  if not exists (select 1 from information_schema.columns where table_name = 'order_items' and column_name = 'selected_options') then
    alter table order_items add column selected_options jsonb default '[]'::jsonb;
  end if;
end $$;
