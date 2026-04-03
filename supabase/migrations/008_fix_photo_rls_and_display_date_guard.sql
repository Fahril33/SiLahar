create or replace function public.sync_daily_report_fields()
returns trigger
language plpgsql
as $$
begin
  new.reporter_name = upper(trim(coalesce(new.reporter_name, '')));
  new.normalized_reporter_name = public.normalize_name(new.reporter_name);

  if new.report_date is null then
    new.report_date = public.wita_today();
  end if;

  new.display_date_text = public.wita_display_date(new.report_date);

  return new;
end;
$$;

update public.daily_reports
set reporter_name = upper(trim(coalesce(reporter_name, ''))),
    normalized_reporter_name = public.normalize_name(reporter_name),
    display_date_text = public.wita_display_date(report_date);

drop policy if exists "public manage today's activity photos" on public.daily_report_activity_photos;
drop policy if exists "public manage activity photos on allowed dates" on public.daily_report_activity_photos;

create policy "public manage activity photos on allowed dates"
on public.daily_report_activity_photos
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
      and (
        public.is_public_report_date_allowed(dr.report_date)
        or public.is_admin()
      )
  )
)
with check (
  exists (
    select 1
    from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
      and (
        public.is_public_report_date_allowed(dr.report_date)
        or public.is_admin()
      )
  )
);
