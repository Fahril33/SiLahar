create or replace function public.sync_daily_report_fields()
returns trigger
language plpgsql
as $$
begin
  new.reporter_name = public.format_reporter_name(new.reporter_name);
  new.normalized_reporter_name = public.normalize_name(new.reporter_name);

  if new.report_date is null then
    new.report_date = public.wita_today();
  end if;

  if not public.is_admin() and not public.is_public_report_date_allowed(new.report_date) then
    raise exception 'Hanya laporan hari berjalan yang diizinkan.';
  end if;

  new.display_date_text = public.wita_display_date(new.report_date);

  return new;
end;
$$;
