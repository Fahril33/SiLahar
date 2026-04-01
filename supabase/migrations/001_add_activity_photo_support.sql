create table if not exists public.daily_report_activity_photos (
  id uuid primary key default gen_random_uuid(),
  activity_id uuid not null references public.daily_report_activities(id) on delete cascade,
  storage_path text not null unique,
  public_url text not null,
  original_file_name text not null,
  sort_order integer not null default 1 check (sort_order > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_report_activity_photos_activity
on public.daily_report_activity_photos(activity_id, sort_order);

drop trigger if exists trg_daily_report_activity_photos_updated_at on public.daily_report_activity_photos;
create trigger trg_daily_report_activity_photos_updated_at
before update on public.daily_report_activity_photos
for each row
execute function public.set_updated_at();

alter table public.daily_report_activity_photos enable row level security;

drop policy if exists "public read daily_report_activity_photos" on public.daily_report_activity_photos;
create policy "public read daily_report_activity_photos"
on public.daily_report_activity_photos
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
  )
);

drop policy if exists "public manage today's activity photos" on public.daily_report_activity_photos;
create policy "public manage today's activity photos"
on public.daily_report_activity_photos
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
      and (dr.report_date = public.wita_today() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
      and (dr.report_date = public.wita_today() or public.is_admin())
  )
);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'daily-report-proofs',
  'daily-report-proofs',
  true,
  5242880,
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "public read proof objects" on storage.objects;
create policy "public read proof objects"
on storage.objects
for select
to public
using (bucket_id = 'daily-report-proofs');

drop policy if exists "public upload proof objects" on storage.objects;
create policy "public upload proof objects"
on storage.objects
for insert
to public
with check (bucket_id = 'daily-report-proofs');

drop policy if exists "public update proof objects" on storage.objects;
create policy "public update proof objects"
on storage.objects
for update
to public
using (bucket_id = 'daily-report-proofs')
with check (bucket_id = 'daily-report-proofs');

drop policy if exists "public delete proof objects" on storage.objects;
create policy "public delete proof objects"
on storage.objects
for delete
to public
using (bucket_id = 'daily-report-proofs');
