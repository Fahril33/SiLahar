create or replace function public.wita_display_date(input_date date default public.wita_today())
returns text
language plpgsql
stable
as $$
declare
  day_names text[] := array['MINGGU', 'SENIN', 'SELASA', 'RABU', 'KAMIS', 'JUMAT', 'SABTU'];
  month_names text[] := array['JANUARI', 'FEBRUARI', 'MARET', 'APRIL', 'MEI', 'JUNI', 'JULI', 'AGUSTUS', 'SEPTEMBER', 'OKTOBER', 'NOVEMBER', 'DESEMBER'];
begin
  return day_names[extract(dow from input_date)::int + 1]
    || ', '
    || lpad(extract(day from input_date)::int::text, 2, '0')
    || ' '
    || month_names[extract(month from input_date)::int]
    || ' '
    || extract(year from input_date)::int;
end;
$$;

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

  if new.display_date_text is null or btrim(new.display_date_text) = '' then
    new.display_date_text = public.wita_display_date(new.report_date);
  else
    new.display_date_text = upper(trim(new.display_date_text));
  end if;

  return new;
end;
$$;

alter table public.daily_reports
alter column report_date set default public.wita_today();

alter table public.daily_reports
alter column display_date_text set default public.wita_display_date(public.wita_today());

update public.daily_reports
set reporter_name = upper(trim(reporter_name)),
    display_date_text = case
      when display_date_text is null or btrim(display_date_text) = '' then public.wita_display_date(report_date)
      else upper(trim(display_date_text))
    end;

update public.reporter_directory
set full_name = upper(trim(full_name));

drop trigger if exists trg_daily_reports_normalize_name on public.daily_reports;
create trigger trg_daily_reports_sync_fields
before insert or update of reporter_name, display_date_text, report_date on public.daily_reports
for each row
execute function public.sync_daily_report_fields();

alter table public.daily_report_activities
drop column if exists proof_text;

update public.report_templates
set schema_json = jsonb_build_object(
  'header_fields', jsonb_build_array('nama', 'hari_tanggal'),
  'activity_fields', jsonb_build_array('no', 'detail_aktivitas', 'jam_mulai', 'jam_selesai', 'foto_bukti'),
  'timezone', 'Asia/Makassar'
)
where template_code = 'bpbd-trc-harian-2026';
