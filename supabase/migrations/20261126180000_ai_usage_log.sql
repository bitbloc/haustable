-- Estimated AI spend (Claude), one row per call, from Haustable edge functions and
-- from Yuzu through the ai-usage-ingest function. Written only with the service role.
-- Read by owners/admins through ai_usage_summary().

create table if not exists public.ai_usage_log (
  id bigserial primary key,
  created_at timestamptz not null default now(),
  source text not null check (source in ('haustable', 'yuzu')),
  feature text not null default 'other',
  model text not null,
  input_tokens integer not null default 0,
  output_tokens integer not null default 0,
  cache_read_tokens integer not null default 0,
  cache_write_tokens integer not null default 0,
  cost_usd numeric(12, 6) not null default 0,
  usd_thb_rate numeric(8, 4),
  cost_thb numeric(12, 4) not null default 0
);

create index if not exists ai_usage_log_created_at_idx on public.ai_usage_log (created_at);

alter table public.ai_usage_log enable row level security;

drop policy if exists ai_usage_log_admin_read on public.ai_usage_log;
create policy ai_usage_log_admin_read on public.ai_usage_log
  for select to authenticated using (public.is_admin());

revoke insert, update, delete on public.ai_usage_log from anon, authenticated;

-- Per Bangkok day, source, model and feature, between two dates (inclusive).
create or replace function public.ai_usage_summary(p_from date, p_to date)
returns table (
  day date,
  source text,
  model text,
  feature text,
  calls bigint,
  input_tokens bigint,
  output_tokens bigint,
  cost_usd numeric,
  cost_thb numeric
)
language sql
stable
security invoker
set search_path = public
as $$
  select
    (l.created_at at time zone 'Asia/Bangkok')::date as day,
    l.source, l.model, l.feature,
    count(*)::bigint,
    sum(l.input_tokens + l.cache_read_tokens + l.cache_write_tokens)::bigint,
    sum(l.output_tokens)::bigint,
    sum(l.cost_usd),
    sum(l.cost_thb)
  from public.ai_usage_log l
  where (l.created_at at time zone 'Asia/Bangkok')::date between p_from and p_to
  group by 1, 2, 3, 4
  order by 1;
$$;

revoke all on function public.ai_usage_summary(date, date) from public, anon;
grant execute on function public.ai_usage_summary(date, date) to authenticated;
