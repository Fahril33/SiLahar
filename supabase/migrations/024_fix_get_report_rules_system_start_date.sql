-- Migration: Fix get_report_rules RPC to return system_start_date
-- AND add read-only access to app_settings for report_rules key

-- 1. Update RPC to include system_start_date
drop function if exists public.get_report_rules();

create or replace function public.get_report_rules()
returns table (
  allow_any_report_date boolean,
  max_photos_per_activity integer,
  system_start_date text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select (value->>'allow_any_report_date')::boolean
        from public.app_settings
        where key = 'report_rules'
      ),
      false
    ) as allow_any_report_date,
    public.current_max_photos_per_activity() as max_photos_per_activity,
    coalesce(
      (
        select value->>'system_start_date'
        from public.app_settings
        where key = 'report_rules'
      ),
      ''
    ) as system_start_date;
$$;

grant execute on function public.get_report_rules() to anon, authenticated;

-- 2. Add read-only (SELECT) policy for anon and authenticated on app_settings
-- so direct queries to app_settings also work for fetching report_rules
drop policy if exists "public read app_settings" on public.app_settings;
create policy "public read app_settings"
on public.app_settings for select to anon, authenticated
using (true);
