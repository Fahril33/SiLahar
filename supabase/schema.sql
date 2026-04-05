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
  first_reported_at timestamptz,
  last_reported_at timestamptz,
  total_reports integer not null default 0,
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

create table if not exists public.report_template_approvers (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  approver_role text not null check (approver_role in ('coordinator_team', 'division_head')),
  scope_label text not null,
  official_name text not null,
  official_title text,
  official_nip text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, approver_role)
);

create table if not exists public.excel_report_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  cache_version text not null,
  storage_path text not null unique,
  public_url text not null,
  is_active boolean not null default false,
  uploaded_by_admin_id uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.report_templates(id) on delete set null,
  reporter_directory_id uuid references public.reporter_directory(id) on delete set null,
  reporter_name text not null,
  normalized_reporter_name text not null,
  display_date_text text not null,
  report_date date not null,
  template_approver_coordinator_id uuid references public.report_template_approvers(id) on delete set null,
  approver_coordinator_name text,
  approver_coordinator_nip text,
  template_approver_division_head_id uuid references public.report_template_approvers(id) on delete set null,
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

create table if not exists public.daily_report_audit_logs (
  id bigserial primary key,
  report_id uuid references public.daily_reports(id) on delete set null,
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
create index if not exists idx_report_template_approvers_template_role on public.report_template_approvers(template_id, approver_role);
create index if not exists idx_daily_report_activities_report_order on public.daily_report_activities(report_id, activity_order);
create index if not exists idx_daily_report_activity_photos_activity on public.daily_report_activity_photos(activity_id, sort_order);
create unique index if not exists uq_excel_report_templates_single_active
on public.excel_report_templates (is_active)
where is_active = true;

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

  new.display_date_text = public.wita_display_date(new.report_date);

  return new;
end;
$$;

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

drop trigger if exists trg_reporter_directory_sync_name on public.reporter_directory;
create trigger trg_reporter_directory_sync_name
before insert or update of full_name on public.reporter_directory
for each row
execute function public.sync_reporter_directory_name();

drop trigger if exists trg_report_templates_updated_at on public.report_templates;
create trigger trg_report_templates_updated_at
before update on public.report_templates
for each row
execute function public.set_updated_at();

drop trigger if exists trg_report_template_approvers_updated_at on public.report_template_approvers;
create trigger trg_report_template_approvers_updated_at
before update on public.report_template_approvers
for each row
execute function public.set_updated_at();

drop trigger if exists trg_excel_report_templates_updated_at on public.excel_report_templates;
create trigger trg_excel_report_templates_updated_at
before update on public.excel_report_templates
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

drop trigger if exists trg_daily_report_activity_photos_updated_at on public.daily_report_activity_photos;
create trigger trg_daily_report_activity_photos_updated_at
before update on public.daily_report_activity_photos
for each row
execute function public.set_updated_at();

drop trigger if exists trg_daily_reports_normalize_name on public.daily_reports;
drop trigger if exists trg_daily_reports_sync_fields on public.daily_reports;
create trigger trg_daily_reports_sync_fields
before insert or update of reporter_name, display_date_text, report_date on public.daily_reports
for each row
execute function public.sync_daily_report_fields();

alter table public.admin_profiles enable row level security;
alter table public.reporter_directory enable row level security;
alter table public.report_templates enable row level security;
alter table public.report_template_notes enable row level security;
alter table public.report_template_approvers enable row level security;
alter table public.excel_report_templates enable row level security;
alter table public.daily_reports enable row level security;
alter table public.daily_report_activities enable row level security;
alter table public.daily_report_activity_photos enable row level security;
alter table public.daily_report_audit_logs enable row level security;
alter table public.app_settings enable row level security;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.is_active = true
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admin can read admin_profiles" on public.admin_profiles;
drop policy if exists "authenticated users can read own admin profile" on public.admin_profiles;
drop policy if exists "active admins can read admin_profiles" on public.admin_profiles;

create policy "authenticated users can read own admin profile"
on public.admin_profiles
for select
to authenticated
using (
  id = auth.uid()
  and is_active = true
);

create policy "active admins can read admin_profiles"
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

drop policy if exists "read active template approvers" on public.report_template_approvers;
create policy "read active template approvers"
on public.report_template_approvers
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.report_templates rt
    where rt.id = report_template_approvers.template_id
      and rt.is_active = true
  )
);

drop policy if exists "admin manage template approvers" on public.report_template_approvers;
create policy "admin manage template approvers"
on public.report_template_approvers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists "public read active excel_report_templates" on public.excel_report_templates;
create policy "public read active excel_report_templates"
on public.excel_report_templates
for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "admin manage excel_report_templates" on public.excel_report_templates;
create policy "admin manage excel_report_templates"
on public.excel_report_templates
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

grant execute on function public.is_public_report_date_allowed(date) to anon, authenticated;

drop policy if exists "public create reports on allowed dates" on public.daily_reports;
create policy "public create reports on allowed dates"
on public.daily_reports
for insert
to anon, authenticated
with check (
  public.is_public_report_date_allowed(report_date) or public.is_admin()
);

drop policy if exists "public update today's report only" on public.daily_reports;
drop policy if exists "public update reports on allowed dates" on public.daily_reports;
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
drop policy if exists "public manage activities on allowed dates" on public.daily_report_activities;
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
set search_path = public
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
    values (
      null,
      'delete',
      old.updated_by_role,
      old.updated_by_label,
      old.updated_by_admin_id,
      jsonb_build_object(
        'deleted_report_id', old.id,
        'deleted_report', to_jsonb(old)
      )
    );
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

create or replace function public.rename_reporter_directory_profile(
  reporter_id_input uuid,
  next_full_name_input text
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_input text := public.normalize_name(next_full_name_input);
  uppercase_input text := upper(trim(coalesce(next_full_name_input, '')));
  current_normalized_name text;
begin
  if not public.is_admin() then
    raise exception 'Akses admin diperlukan.';
  end if;

  if reporter_id_input is null then
    raise exception 'ID pengguna publik tidak valid.';
  end if;

  if uppercase_input = '' then
    raise exception 'Nama pengguna publik wajib diisi.';
  end if;

  select normalized_name
  into current_normalized_name
  from public.reporter_directory
  where id = reporter_id_input
  limit 1;

  if current_normalized_name is null then
    raise exception 'Data pengguna publik tidak ditemukan.';
  end if;

  if exists (
    select 1
    from public.reporter_directory
    where normalized_name = normalized_input
      and id <> reporter_id_input
  ) then
    raise exception 'Nama pengguna publik tersebut sudah terdaftar.';
  end if;

  update public.reporter_directory
  set full_name = uppercase_input,
      is_active = true,
      updated_at = now()
  where id = reporter_id_input;

  update public.daily_reports
  set reporter_name = uppercase_input,
      reporter_directory_id = reporter_id_input,
      updated_by_role = 'admin',
      updated_by_label = 'Admin',
      updated_at = now()
  where reporter_directory_id = reporter_id_input
    or normalized_reporter_name = current_normalized_name;
end;
$$;

create or replace function public.delete_reporter_directory_trace(
  reporter_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  current_normalized_name text;
begin
  if not public.is_admin() then
    raise exception 'Akses admin diperlukan.';
  end if;

  if reporter_id_input is null then
    raise exception 'ID pengguna publik tidak valid.';
  end if;

  select normalized_name
  into current_normalized_name
  from public.reporter_directory
  where id = reporter_id_input
  limit 1;

  if current_normalized_name is null then
    raise exception 'Data pengguna publik tidak ditemukan.';
  end if;

  delete from public.daily_reports
  where reporter_directory_id = reporter_id_input
    or normalized_reporter_name = current_normalized_name;

  delete from public.reporter_directory
  where id = reporter_id_input;
end;
$$;

grant execute on function public.rename_reporter_directory_profile(uuid, text) to authenticated;
grant execute on function public.delete_reporter_directory_trace(uuid) to authenticated;

create or replace function public.set_active_excel_report_template(
  template_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses admin diperlukan.';
  end if;

  if template_id_input is null then
    raise exception 'Template Excel belum valid.';
  end if;

  if not exists (
    select 1
    from public.excel_report_templates
    where id = template_id_input
  ) then
    raise exception 'Template Excel tidak ditemukan.';
  end if;

  update public.excel_report_templates
  set is_active = false,
      updated_at = now()
  where is_active = true;

  update public.excel_report_templates
  set is_active = true,
      updated_at = now()
  where id = template_id_input;
end;
$$;

grant execute on function public.set_active_excel_report_template(uuid) to authenticated;

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

insert into public.report_template_approvers (
  template_id,
  approver_role,
  scope_label,
  official_name,
  official_title,
  official_nip,
  is_active
)
select
  rt.id,
  approvers.approver_role,
  approvers.scope_label,
  approvers.official_name,
  approvers.official_title,
  approvers.official_nip,
  true
from public.report_templates rt
cross join (
  values
    (
      'coordinator_team',
      'KOORDINATOR TIM',
      'ARIS PEBRIANSYAH, S.STP, M.AP',
      null,
      '199602102018081001'
    ),
    (
      'division_head',
      'KEPALA BIDANG KEDARURATAN & LOGISTIK',
      'ANDY A SEMBIRING,.S.STP,.M.Si',
      'Pembina Utama Tkt I',
      '19831221 200212 1 004'
    )
) as approvers(
  approver_role,
  scope_label,
  official_name,
  official_title,
  official_nip
)
where rt.template_code = 'bpbd-trc-harian-2026'
on conflict (template_id, approver_role) do update
set scope_label = excluded.scope_label,
    official_name = excluded.official_name,
    official_title = excluded.official_title,
    official_nip = excluded.official_nip,
    is_active = excluded.is_active,
    updated_at = now();

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
  ),
  (
    'report_rules',
    jsonb_build_object(
      'allow_any_report_date', true,
      'max_photos_per_activity', 1
    )
  ),
  (
    'notification_settings',
    jsonb_build_object(
      'show_admin_sound_settings', false,
      'disable_sound_responses_for_all_users', false,
      'success', jsonb_build_object(
        'mode', 'random',
        'specific_file', null
      ),
      'fail', jsonb_build_object(
        'mode', 'random',
        'specific_file', null
      )
    )
  )
on conflict (key) do update
set value = excluded.value,
    updated_at = now();

with default_template as (
  select rt.id
  from public.report_templates rt
  where rt.template_code = 'bpbd-trc-harian-2026'
  limit 1
)
update public.daily_reports dr
set template_id = default_template.id
from default_template
where dr.template_id is null;

with template_approvers as (
  select
    rta.id,
    rta.template_id,
    rta.approver_role
  from public.report_template_approvers rta
)
update public.daily_reports dr
set template_approver_coordinator_id = ta.id
from template_approvers ta
where ta.template_id = dr.template_id
  and ta.approver_role = 'coordinator_team'
  and dr.template_approver_coordinator_id is null;

with template_approvers as (
  select
    rta.id,
    rta.template_id,
    rta.approver_role
  from public.report_template_approvers rta
)
update public.daily_reports dr
set template_approver_division_head_id = ta.id
from template_approvers ta
where ta.template_id = dr.template_id
  and ta.approver_role = 'division_head'
  and dr.template_approver_division_head_id is null;

create or replace function public.current_max_photos_per_activity()
returns integer
language sql
stable
security definer
set search_path = public
as $$
  select greatest(
    1,
    coalesce(
      (
        select (value->>'max_photos_per_activity')::int
        from public.app_settings
        where key = 'report_rules'
      ),
      1
    )
  );
$$;

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

drop function if exists public.get_notification_settings();

create function public.get_notification_settings()
returns table (
  show_admin_sound_settings boolean,
  disable_sound_responses_for_all_users boolean,
  success jsonb,
  fail jsonb
)
language sql
stable
security definer
set search_path = public
as $$
  select
    coalesce(
      (
        select (value->>'show_admin_sound_settings')::boolean
        from public.app_settings
        where key = 'notification_settings'
      ),
      false
    ) as show_admin_sound_settings,
    coalesce(
      (
        select (value->>'disable_sound_responses_for_all_users')::boolean
        from public.app_settings
        where key = 'notification_settings'
      ),
      false
    ) as disable_sound_responses_for_all_users,
    coalesce(
      (
        select value->'success'
        from public.app_settings
        where key = 'notification_settings'
      ),
      jsonb_build_object('mode', 'random', 'specific_file', null)
    ) as success,
    coalesce(
      (
        select value->'fail'
        from public.app_settings
        where key = 'notification_settings'
      ),
      jsonb_build_object('mode', 'random', 'specific_file', null)
    ) as fail;
$$;

grant execute on function public.current_max_photos_per_activity() to anon, authenticated;
grant execute on function public.get_report_rules() to anon, authenticated;
grant execute on function public.get_notification_settings() to anon, authenticated;
