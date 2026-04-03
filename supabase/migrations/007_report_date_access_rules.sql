insert into public.app_settings (key, value)
values (
  'report_rules',
  jsonb_build_object(
    'allow_any_report_date', true,
    'max_photos_per_activity', 1
  )
)
on conflict (key) do update
set value = jsonb_build_object(
      'allow_any_report_date',
      coalesce(
        (public.app_settings.value->>'allow_any_report_date')::boolean,
        true
      ),
      'max_photos_per_activity',
      greatest(
        1,
        coalesce((public.app_settings.value->>'max_photos_per_activity')::int, 1)
      )
    ),
    updated_at = now();

create or replace function public.is_public_report_date_allowed(target_report_date date)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select
    target_report_date = public.wita_today()
    or coalesce(
      (
        select (value->>'allow_any_report_date')::boolean
        from public.app_settings
        where key = 'report_rules'
      ),
      false
    );
$$;

drop function if exists public.get_report_rules();

create or replace function public.get_report_rules()
returns table (
  allow_any_report_date boolean,
  max_photos_per_activity integer
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
    public.current_max_photos_per_activity() as max_photos_per_activity;
$$;

grant execute on function public.is_public_report_date_allowed(date) to anon, authenticated;
grant execute on function public.get_report_rules() to anon, authenticated;

drop policy if exists "public create today's report" on public.daily_reports;
create policy "public create reports on allowed dates"
on public.daily_reports
for insert
to anon, authenticated
with check (
  public.is_public_report_date_allowed(report_date) or public.is_admin()
);

drop policy if exists "public update today's report only" on public.daily_reports;
create policy "public update reports on allowed dates"
on public.daily_reports
for update
to anon, authenticated
using (
  public.is_public_report_date_allowed(report_date) or public.is_admin()
)
with check (
  public.is_public_report_date_allowed(report_date) or public.is_admin()
);

drop policy if exists "public manage today's activities" on public.daily_report_activities;
create policy "public manage activities on allowed dates"
on public.daily_report_activities
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
      and (
        public.is_public_report_date_allowed(dr.report_date)
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
      and (
        public.is_public_report_date_allowed(dr.report_date)
        or public.is_admin()
      )
  )
);
