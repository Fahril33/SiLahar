alter table public.reporter_directory
add column if not exists first_reported_at timestamptz,
add column if not exists last_reported_at timestamptz,
add column if not exists total_reports integer not null default 0;

create or replace function public.sync_reporter_directory_name()
returns trigger
language plpgsql
as $$
begin
  new.full_name = upper(trim(coalesce(new.full_name, '')));
  new.normalized_name = public.normalize_name(new.full_name);
  return new;
end;
$$;

drop trigger if exists trg_reporter_directory_sync_name on public.reporter_directory;
create trigger trg_reporter_directory_sync_name
before insert or update of full_name on public.reporter_directory
for each row
execute function public.sync_reporter_directory_name();

with aggregated as (
  select
    upper(trim(reporter_name)) as full_name,
    public.normalize_name(reporter_name) as normalized_name,
    min(created_at) as first_reported_at,
    max(updated_at) as last_reported_at,
    count(*)::int as total_reports
  from public.daily_reports
  group by 1, 2
)
insert into public.reporter_directory (
  full_name,
  normalized_name,
  first_reported_at,
  last_reported_at,
  total_reports,
  is_active
)
select
  aggregated.full_name,
  aggregated.normalized_name,
  aggregated.first_reported_at,
  aggregated.last_reported_at,
  aggregated.total_reports,
  true
from aggregated
on conflict (normalized_name) do update
set full_name = excluded.full_name,
    first_reported_at = coalesce(public.reporter_directory.first_reported_at, excluded.first_reported_at),
    last_reported_at = greatest(coalesce(public.reporter_directory.last_reported_at, excluded.last_reported_at), excluded.last_reported_at),
    total_reports = greatest(public.reporter_directory.total_reports, excluded.total_reports),
    updated_at = now();
