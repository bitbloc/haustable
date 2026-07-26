-- Enable the pg_net extension to make HTTP requests
create extension if not exists pg_net;

create or replace function public.handle_new_order_push()
returns trigger as $$
declare
  payload jsonb;
  project_url text := 'https://lxfavbzmebqqsffgyyph.supabase.co';
  anon_key text := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx4ZmF2YnptZWJxcXNmZmd5eXBoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjU0MjI5MTMsImV4cCI6MjA4MDk5ODkxM30.oMFT06OnUFzrmGjGpW12jizbxvwcwFeKV7r6HykrLfI';
  function_url text := project_url || '/functions/v1/send-web-push';
begin
  -- Construct Payload
  payload := jsonb_build_object(
      'title', 'New Order!',
      'body', 'Order #' || new.id || ' - ' || new.total_amount || '.-',
      'url', '/staff'
  );

  -- Call Edge Function via pg_net
  perform
    net.http_post(
      url := function_url,
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'Authorization', 'Bearer ' || anon_key
      ),
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
