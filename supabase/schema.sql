create extension if not exists pgcrypto;

create or replace function public.wita_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Makassar')::date;
$$;

create or replace function public.normalize_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(value, ''))), '\s+', ' ', 'g');
$$;

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.reporter_directory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  normalized_name text not null unique,
  unit_name text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_templates (
  id uuid primary key default gen_random_uuid(),
  template_code text not null unique,
  template_name text not null,
  organization_name text,
  budget_year integer,
  schema_json jsonb not null default '{}'::jsonb,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.report_template_notes (
  id bigserial primary key,
  template_id uuid not null references public.report_templates(id) on delete cascade,
  note_order integer not null check (note_order > 0),
  note_text text not null,
  created_at timestamptz not null default now(),
  unique (template_id, note_order)
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.report_templates(id) on delete set null,
  reporter_directory_id uuid references public.reporter_directory(id) on delete set null,
  reporter_name text not null,
  normalized_reporter_name text not null,
  display_date_text text not null,
  report_date date not null,
  approver_coordinator_name text,
  approver_coordinator_nip text,
  approver_division_head_name text,
  approver_division_head_title text,
  approver_division_head_nip text,
  created_by_role text not null check (created_by_role in ('admin', 'anonymous')),
  created_by_label text not null,
  updated_by_role text not null check (updated_by_role in ('admin', 'anonymous')),
  updated_by_label text not null,
  created_by_admin_id uuid references public.admin_profiles(id) on delete set null,
  updated_by_admin_id uuid references public.admin_profiles(id) on delete set null,
  edit_token uuid not null default gen_random_uuid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_daily_report_per_name_day unique (normalized_reporter_name, report_date)
);

create table if not exists public.daily_report_activities (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  activity_order integer not null check (activity_order > 0),
  activity_description text not null,
  start_time_text text not null,
  end_time_text text not null,
  proof_text text not null default 'Terlampir',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, activity_order)
);

create table if not exists public.daily_report_audit_logs (
  id bigserial primary key,
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  action_type text not null check (action_type in ('create', 'update', 'delete', 'export')),
  actor_role text not null check (actor_role in ('admin', 'anonymous')),
  actor_label text not null,
  actor_admin_id uuid references public.admin_profiles(id) on delete set null,
  snapshot jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

create index if not exists idx_daily_reports_report_date on public.daily_reports(report_date desc);
create index if not exists idx_daily_reports_name_date on public.daily_reports(normalized_reporter_name, report_date desc);
create index if not exists idx_daily_report_activities_report_order on public.daily_report_activities(report_id, activity_order);

create or replace function public.sync_reporter_name()
returns trigger
language plpgsql
as $$
begin
  new.normalized_reporter_name = public.normalize_name(new.reporter_name);
  return new;
end;
$$;

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at
before update on public.admin_profiles
for each row
execute function public.set_updated_at();

drop trigger if exists trg_reporter_directory_updated_at on public.reporter_directory;
create trigger trg_reporter_directory_updated_at
before update on public.reporter_directory
for each row
execute function public.set_updated_at();

drop trigger if exists trg_report_templates_updated_at on public.report_templates;
create trigger trg_report_templates_updated_at
before update on public.report_templates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_daily_reports_updated_at on public.daily_reports;
create trigger trg_daily_reports_updated_at
before update on public.daily_reports
for each row
execute function public.set_updated_at();

drop trigger if exists trg_daily_report_activities_updated_at on public.daily_report_activities;
create trigger trg_daily_report_activities_updated_at
before update on public.daily_report_activities
for each row
execute function public.set_updated_at();

drop trigger if exists trg_daily_reports_normalize_name on public.daily_reports;
create trigger trg_daily_reports_normalize_name
before insert or update of reporter_name on public.daily_reports
for each row
execute function public.sync_reporter_name();

alter table public.admin_profiles enable row level security;
alter table public.reporter_directory enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_template_notes enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_activities enable row level security;
alter table public.daily_report_audit_logs enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.is_active = true
  );
$$;

drop policy if exists "admin can read admin_profiles" on public.admin_profiles;
create policy "admin can read admin_profiles"
on public.admin_profiles
for select
to authenticated
using (public.is_admin());

drop policy if exists "admin manage reporter_directory" on public.reporter_directory;
create policy "admin manage reporter_directory"
on public.reporter_directory
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public read reporter_directory" on public.reporter_directory;
create policy "public read reporter_directory"
on public.reporter_directory
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "admin manage report_templates" on public.report_templates;
create policy "admin manage report_templates"
on public.report_templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "read active templates" on public.report_templates;
create policy "read active templates"
on public.report_templates
for select
to anon, authenticated
using (is_active = true);

drop policy if exists "read active template notes" on public.report_template_notes;
create policy "read active template notes"
on public.report_template_notes
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.report_templates rt
    where rt.id = report_template_notes.template_id
      and rt.is_active = true
  )
);

drop policy if exists "admin manage template notes" on public.report_template_notes;
create policy "admin manage template notes"
on public.report_template_notes
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public read daily_reports" on public.daily_reports;
create policy "public read daily_reports"
on public.daily_reports
for select
to anon, authenticated
using (true);

drop policy if exists "public create today's report" on public.daily_reports;
create policy "public create today's report"
on public.daily_reports
for insert
to anon, authenticated
with check (report_date = public.wita_today());

drop policy if exists "public update today's report only" on public.daily_reports;
create policy "public update today's report only"
on public.daily_reports
for update
to anon, authenticated
using (report_date = public.wita_today() or public.is_admin())
with check (report_date = public.wita_today() or public.is_admin());

drop policy if exists "admin delete all daily_reports" on public.daily_reports;
create policy "admin delete all daily_reports"
on public.daily_reports
for delete
to authenticated
using (public.is_admin());

drop policy if exists "public read daily_report_activities" on public.daily_report_activities;
create policy "public read daily_report_activities"
on public.daily_report_activities
for select
to anon, authenticated
using (
  exists (
    select 1
    from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
  )
);

drop policy if exists "public manage today's activities" on public.daily_report_activities;
create policy "public manage today's activities"
on public.daily_report_activities
for all
to anon, authenticated
using (
  exists (
    select 1
    from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
      and (dr.report_date = public.wita_today() or public.is_admin())
  )
)
with check (
  exists (
    select 1
    from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
      and (dr.report_date = public.wita_today() or public.is_admin())
  )
);

drop policy if exists "admin read audit logs" on public.daily_report_audit_logs;
create policy "admin read audit logs"
on public.daily_report_audit_logs
for select
to authenticated
using (public.is_admin());

drop policy if exists "system append audit logs" on public.daily_report_audit_logs;
create policy "system append audit logs"
on public.daily_report_audit_logs
for insert
to anon, authenticated
with check (true);

drop policy if exists "admin manage app_settings" on public.app_settings;
create policy "admin manage app_settings"
on public.app_settings
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.report_payload(report_uuid uuid)
returns jsonb
language sql
stable
as $$
  select jsonb_build_object(
    'report', to_jsonb(dr),
    'activities',
    coalesce(
      (
        select jsonb_agg(to_jsonb(dra) order by dra.activity_order)
        from public.daily_report_activities dra
        where dra.report_id = dr.id
      ),
      '[]'::jsonb
    )
  )
  from public.daily_reports dr
  where dr.id = report_uuid;
$$;

create or replace function public.log_daily_report_changes()
returns trigger
language plpgsql
security definer
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.daily_report_audit_logs (report_id, action_type, actor_role, actor_label, actor_admin_id, snapshot)
    values (new.id, 'create', new.created_by_role, new.created_by_label, new.created_by_admin_id, public.report_payload(new.id));
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.daily_report_audit_logs (report_id, action_type, actor_role, actor_label, actor_admin_id, snapshot)
    values (
      new.id,
      'update',
      new.updated_by_role,
      new.updated_by_label,
      new.updated_by_admin_id,
      jsonb_build_object(
        'old_report', to_jsonb(old),
        'new_payload', public.report_payload(new.id)
      )
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.daily_report_audit_logs (report_id, action_type, actor_role, actor_label, actor_admin_id, snapshot)
    values (old.id, 'delete', old.updated_by_role, old.updated_by_label, old.updated_by_admin_id, to_jsonb(old));
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists trg_daily_reports_audit on public.daily_reports;
create trigger trg_daily_reports_audit
after insert or update or delete on public.daily_reports
for each row
execute function public.log_daily_report_changes();

insert into public.report_templates (
  template_code,
  template_name,
  organization_name,
  budget_year,
  schema_json,
  is_active
)
values (
  'bpbd-trc-harian-2026',
  'Laporan Harian Kinerja Tim Reaksi Cepat',
  'Badan Penanggulangan Bencana Daerah Provinsi Sulawesi Tengah',
  2026,
  jsonb_build_object(
    'header_fields', jsonb_build_array('nama', 'hari_tanggal'),
    'activity_fields', jsonb_build_array('no', 'detail_aktivitas', 'jam_mulai', 'jam_selesai', 'bukti_dokumentasi'),
    'timezone', 'Asia/Makassar'
  ),
  true
)
on conflict (template_code) do update
set template_name = excluded.template_name,
    organization_name = excluded.organization_name,
    budget_year = excluded.budget_year,
    schema_json = excluded.schema_json,
    is_active = excluded.is_active,
    updated_at = now();

insert into public.report_template_notes (template_id, note_order, note_text)
select rt.id, notes.note_order, notes.note_text
from public.report_templates rt
cross join (
  values
    (1, 'DIKUMPULKAN SETIAP HARI DI ADMIN.'),
    (2, 'LAPORAN DI KUMPULKAN DENGAN MAP SNEILHEKTER YANG TELAH DI BERIKAN NAMA MASING2.')
) as notes(note_order, note_text)
where rt.template_code = 'bpbd-trc-harian-2026'
on conflict (template_id, note_order) do update
set note_text = excluded.note_text;

insert into public.app_settings (key, value)
values
  (
    'application_timezone',
    jsonb_build_object(
      'label', 'WITA',
      'iana_timezone', 'Asia/Makassar',
      'utc_offset', '+08:00'
    )
  ),
  (
    'default_report_template_code',
    jsonb_build_object(
      'template_code', 'bpbd-trc-harian-2026'
    )
  )
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
