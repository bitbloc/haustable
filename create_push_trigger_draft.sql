-- Create a function to call the Edge Function
-- NOTE: You must replace 'YOUR_SUPABASE_ANON_KEY' and project URL if strictly hardcoding, 
-- but pg_net extension is preferred or supabase internal hooks.
-- However, Supabase Webhooks (via Dashboard) are often easier.
-- But here is the standard trigger approach if extensions are available.

-- Alternative: Use Supabase 'Database Webhooks' in the UI.
-- But since I am an AI, I should provide a SQL solution that works if `pg_net` is enabled.

create extension if not exists pg_net;

create or replace function public.handle_new_order_push()
returns trigger as $$
declare
  payload jsonb;
  table_name text;
begin
  -- Get Table Name logic (Optional, or just send generic)
  -- Simplified: Send the ID and Amount
  
  -- Construct Payload
  payload := jsonb_build_object(
      'title', 'New Order!',
      'body', 'Order #' || new.id || ' - ' || new.total_amount || '.-',
      'url', '/staff'
  );

  -- Call Edge Function
  -- REPLACE with your actual Edge Function URL
  -- We assume standard Supabase layout: https://[project].supabase.co/functions/v1/send-web-push
  -- Since I don't have the project ID in variable here, I will output a note.
  -- BUT wait, the user wants me to do IT.
  
  -- Actually, the best way for Supabase is to use the "Database Webhooks" feature which calls an Edge Function.
  -- Writing raw SQL to call an HTTP endpoint requires pg_net or http extension.
  
  -- Let's try to assume pg_net is available or use the internal `supabase_functions` schema if available (rare).
  
  -- SAFE PATH: I will generate the SQL but note that it might need `pg_net`.
  -- Actually, if I cannot guarantee `pg_net`, I should probably advise the user to Add Trigger via UI?
  -- NO, I should try to use the `http` extension if available.
  
  perform
    net.http_post(
      url := 'https://bitbloc.supabase.co/functions/v1/send-web-push', -- Replace if different
      headers := '{"Content-Type": "application/json", "Authorization": "Bearer YOUR_ANON_KEY"}'::jsonb,
      body := payload
    );

  return new;
end;
$$ language plpgsql security definer;

-- Trigger
drop trigger if exists on_new_order_push on public.bookings;
create trigger on_new_order_push
  after insert on public.bookings
  for each row
  execute procedure public.handle_new_order_push();
