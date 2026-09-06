-- ======================================================================================
-- SiLahar (Sistem Laporan Harian Tim Reaksi Cepat & Pusdalops BPBD Provinsi Sulawesi Tengah)
-- CONSOLIDATED SQL MIGRATION FILE (001 to 021)
-- ======================================================================================
-- File ini merupakan gabungan utuh dan terpadu dari seluruh file migrasi (001 s/d 021)
-- yang telah disesuaikan dengan arsitektur dan pembaruan skema database terbaru.
-- Idempoten: aman dieksekusi pada database baru maupun database yang sudah ada.
-- ======================================================================================

-- --------------------------------------------------------------------------------------
-- 1. EXTENSIONS & FUNGSI UTILITAS DASAR
-- --------------------------------------------------------------------------------------
create extension if not exists pgcrypto;

-- Fungsi penentu tanggal hari berjalan zona waktu WITA (Asia/Makassar)
create or replace function public.wita_today()
returns date
language sql
stable
as $$
  select (now() at time zone 'Asia/Makassar')::date;
$$;

-- Fungsi normalisasi string nama (lowercase, spasi tunggal)
create or replace function public.normalize_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(lower(trim(coalesce(value, ''))), '\s+', ' ', 'g');
$$;

-- Fungsi format nama pelapor (mempertahankan casing asli, membersihkan whitespace ganda) [017]
create or replace function public.format_reporter_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g');
$$;

-- Fungsi format teks tanggal Indonesia berhuruf kapital (Contoh: SENIN, 02 MARET 2026) [002]
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

-- Trigger function untuk otomatisasi kolom updated_at
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- --------------------------------------------------------------------------------------
-- 2. TABEL-TABEL UTAMA SISTEM
-- --------------------------------------------------------------------------------------

-- Tabel Profil Administrator
create table if not exists public.admin_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabel Direktori Pengguna / Pelapor (Petugas TRC / Pusdalops) [003, 017, 020]
create table if not exists public.reporter_directory (
  id uuid primary key default gen_random_uuid(),
  full_name text not null unique,
  normalized_name text not null unique,
  unit_name text,
  password text not null default '123123123',
  first_reported_at timestamptz,
  last_reported_at timestamptz,
  total_reports integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Tabel Template Laporan
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

-- Tabel Catatan Footer Template Laporan
create table if not exists public.report_template_notes (
  id bigserial primary key,
  template_id uuid not null references public.report_templates(id) on delete cascade,
  note_order integer not null check (note_order > 0),
  note_text text not null,
  created_at timestamptz not null default now(),
  unique (template_id, note_order)
);

-- Tabel Pejabat Penandatangan Template Laporan [013, 018]
create table if not exists public.report_template_approvers (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  approver_role text not null check (approver_role in ('coordinator_team_trc', 'coordinator_team_pusdalops', 'division_head')),
  scope_label text not null,
  official_name text not null,
  official_title text,
  official_nip text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, approver_role)
);

-- Tabel Template Dokumen Excel [012]
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

-- Tabel Utama: Laporan Harian (Daily Reports) [002, 013, 018]
create table if not exists public.daily_reports (
  id uuid primary key default gen_random_uuid(),
  template_id uuid references public.report_templates(id) on delete set null,
  reporter_directory_id uuid references public.reporter_directory(id) on delete set null,
  reporter_name text not null,
  normalized_reporter_name text not null,
  tim text not null default 'PUSDALOPS',
  display_date_text text not null default public.wita_display_date(public.wita_today()),
  report_date date not null default public.wita_today(),
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

-- Tabel Aktivitas Laporan Harian (Daily Report Activities) [002]
create table if not exists public.daily_report_activities (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.daily_reports(id) on delete cascade,
  activity_order integer not null check (activity_order > 0),
  activity_description text not null,
  start_time_text text not null,
  end_time_text text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (report_id, activity_order)
);

-- Pastikan kolom legacy proof_text dihapus bila ada [002]
alter table public.daily_report_activities drop column if exists proof_text;

-- Tabel Foto Dokumentasi Bukti Aktivitas [001, 005]
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

-- Tabel Audit Log Perubahan Laporan [010]
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

-- Tabel Pengaturan Konfigurasi Aplikasi (App Settings) [004, 007, 014, 016, 021]
create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- --------------------------------------------------------------------------------------
-- 3. INDEXING DATABASE
-- --------------------------------------------------------------------------------------
create index if not exists idx_daily_reports_report_date on public.daily_reports(report_date desc);
create index if not exists idx_daily_reports_name_date on public.daily_reports(normalized_reporter_name, report_date desc);
create index if not exists idx_report_template_approvers_template_role on public.report_template_approvers(template_id, approver_role);
create index if not exists idx_daily_report_activities_report_order on public.daily_report_activities(report_id, activity_order);
create index if not exists idx_daily_report_activity_photos_activity on public.daily_report_activity_photos(activity_id, sort_order);

-- Indeks unik hanya boleh ada 1 template Excel aktif dalam satu waktu [012]
create unique index if not exists uq_excel_report_templates_single_active
on public.excel_report_templates (is_active)
where is_active = true;

-- --------------------------------------------------------------------------------------
-- 4. FUNGSI LOGIKA BISNIS, VALIDASI, & RPC
-- --------------------------------------------------------------------------------------

-- Validasi status admin tanpa rekursi RLS [009]
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

-- Batas maksimal foto per aktivitas yang berlaku di app_settings [005]
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

-- Cek apakah tanggal laporan diizinkan untuk publik [007]
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

-- RPC: Ambil aturan laporan untuk frontend [007]
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

-- RPC: Ambil pengaturan notifikasi suara publik & admin [015, 016]
create or replace function public.get_notification_settings()
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

-- Trigger function: Penegakan batas jumlah foto saat upload bukti [005]
create or replace function public.enforce_activity_photo_limit()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  max_photos integer := public.current_max_photos_per_activity();
  existing_count integer;
begin
  select count(*)::int
  into existing_count
  from public.daily_report_activity_photos
  where activity_id = new.activity_id
    and id <> coalesce(new.id, '00000000-0000-0000-0000-000000000000'::uuid);

  if existing_count >= max_photos then
    raise exception 'Batas foto untuk aktivitas ini adalah % file. Silakan gunakan % foto saja.', max_photos, max_photos;
  end if;

  if new.sort_order > max_photos then
    new.sort_order = max_photos;
  end if;

  return new;
end;
$$;

-- Trigger function: Sinkronisasi nama pada direktori pengguna [003, 017]
create or replace function public.sync_reporter_directory_name()
returns trigger
language plpgsql
as $$
begin
  new.full_name = public.format_reporter_name(new.full_name);
  new.normalized_name = public.normalize_name(new.full_name);
  return new;
end;
$$;

-- Trigger function: Sinkronisasi field laporan harian & validasi tanggal [002, 008, 017, 019]
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

  -- Validasi izin edit/input berdasarkan aturan tanggal [019]
  if not public.is_admin() and not public.is_public_report_date_allowed(new.report_date) then
    raise exception 'Hanya laporan hari berjalan yang diizinkan.';
  end if;

  new.display_date_text = public.wita_display_date(new.report_date);

  return new;
end;
$$;

-- RPC: Upsert data pelapor ke reporter_directory secara otomatis [006, 017]
create or replace function public.upsert_reporter_directory_for_report(reporter_name_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_input text := public.normalize_name(reporter_name_input);
  formatted_input text := public.format_reporter_name(reporter_name_input);
  existing_row public.reporter_directory%rowtype;
  now_value timestamptz := now();
begin
  if formatted_input = '' then
    raise exception 'Nama pelapor wajib diisi.';
  end if;

  select *
  into existing_row
  from public.reporter_directory
  where normalized_name = normalized_input
  limit 1;

  if found then
    update public.reporter_directory
    set full_name = formatted_input,
        last_reported_at = now_value,
        total_reports = coalesce(total_reports, 0) + 1,
        is_active = true,
        updated_at = now_value
    where id = existing_row.id;

    return existing_row.id;
  end if;

  insert into public.reporter_directory (
    full_name,
    normalized_name,
    first_reported_at,
    last_reported_at,
    total_reports,
    is_active
  )
  values (
    formatted_input,
    normalized_input,
    now_value,
    now_value,
    1,
    true
  )
  returning id into existing_row.id;

  return existing_row.id;
end;
$$;

-- RPC: Ubah nama profil pelapor (Khusus Admin) [011, 017]
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
  formatted_input text := public.format_reporter_name(next_full_name_input);
  current_normalized_name text;
begin
  if not public.is_admin() then
    raise exception 'Akses admin diperlukan.';
  end if;

  if reporter_id_input is null then
    raise exception 'ID pengguna publik tidak valid.';
  end if;

  if formatted_input = '' then
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
  set full_name = formatted_input,
      is_active = true,
      updated_at = now()
  where id = reporter_id_input;

  update public.daily_reports
  set reporter_name = formatted_input,
      reporter_directory_id = reporter_id_input,
      updated_by_role = 'admin',
      updated_by_label = 'Admin',
      updated_at = now()
  where reporter_directory_id = reporter_id_input
    or normalized_reporter_name = current_normalized_name;
end;
$$;

-- RPC: Hapus riwayat pelapor dan seluruh laporannya (Khusus Admin) [011]
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

-- RPC: Atur template Excel aktif (Khusus Admin) [012]
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

-- Fungsi pembantu payload snapshot audit log [010]
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

-- Trigger function pencatat audit log laporan [010]
create or replace function public.log_daily_report_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.daily_report_audit_logs (
      report_id, action_type, actor_role, actor_label, actor_admin_id, snapshot
    )
    values (
      new.id, 'create', new.created_by_role, new.created_by_label, new.created_by_admin_id, public.report_payload(new.id)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.daily_report_audit_logs (
      report_id, action_type, actor_role, actor_label, actor_admin_id, snapshot
    )
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
    insert into public.daily_report_audit_logs (
      report_id, action_type, actor_role, actor_label, actor_admin_id, snapshot
    )
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

-- RPC: Autentikasi Login Petugas / Pelapor [020]
create or replace function public.authenticate_reporter(reporter_name text, pass text)
returns table (
  id uuid,
  full_name text,
  first_reported_at timestamptz,
  last_reported_at timestamptz,
  total_reports integer,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  norm_name text := public.normalize_name(reporter_name);
begin
  return query
  select r.id, r.full_name, r.first_reported_at, r.last_reported_at, r.total_reports, r.is_active
  from public.reporter_directory r
  where r.normalized_name = norm_name
    and r.password = pass
    and r.is_active = true;
end;
$$;

-- RPC: Registrasi Akun Petugas / Pelapor Baru [020]
create or replace function public.register_reporter(reporter_name text, pass text)
returns table (
  id uuid,
  full_name text,
  first_reported_at timestamptz,
  last_reported_at timestamptz,
  total_reports integer,
  is_active boolean
)
language plpgsql
security definer
set search_path = public
as $$
declare
  new_id uuid;
  normalized_input text := public.normalize_name(reporter_name);
  formatted_input text := public.format_reporter_name(reporter_name);
begin
  if formatted_input = '' then
    raise exception 'Nama pelapor wajib diisi.';
  end if;
  if exists (select 1 from public.reporter_directory where normalized_name = normalized_input) then
    raise exception 'Nama pelapor sudah terdaftar.';
  end if;
  
  insert into public.reporter_directory (full_name, normalized_name, password, is_active)
  values (formatted_input, normalized_input, pass, true)
  returning public.reporter_directory.id into new_id;

  return query
  select r.id, r.full_name, r.first_reported_at, r.last_reported_at, r.total_reports, r.is_active
  from public.reporter_directory r
  where r.id = new_id;
end;
$$;

-- RPC: Update Profil & Password Petugas Mandiri [020]
create or replace function public.update_reporter_profile(reporter_id uuid, next_name text, next_password text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_input text := public.normalize_name(next_name);
  formatted_input text := public.format_reporter_name(next_name);
begin
  if formatted_input = '' then
    raise exception 'Nama pelapor tidak boleh kosong.';
  end if;
  
  if exists (
    select 1 from public.reporter_directory 
    where normalized_name = normalized_input and id <> reporter_id
  ) then
    raise exception 'Nama pelapor sudah digunakan oleh pengguna lain.';
  end if;

  update public.reporter_directory
  set full_name = formatted_input,
      normalized_name = normalized_input,
      password = next_password,
      updated_at = now()
  where id = reporter_id;

  update public.daily_reports
  set reporter_name = formatted_input,
      normalized_reporter_name = normalized_input
  where reporter_directory_id = reporter_id;
end;
$$;

-- RPC: Ambil Data Password Petugas (Khusus Admin) [020]
create or replace function public.admin_get_reporter_passwords()
returns table (
  id uuid,
  password text
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses ditolak. Khusus admin.';
  end if;
  
  return query
  select r.id, r.password
  from public.reporter_directory r;
end;
$$;

-- --------------------------------------------------------------------------------------
-- 5. TRIGGERS PENJAGA DATA (TRIGGERS & EVENT HOOKS)
-- --------------------------------------------------------------------------------------

drop trigger if exists trg_admin_profiles_updated_at on public.admin_profiles;
create trigger trg_admin_profiles_updated_at
before update on public.admin_profiles
for each row execute function public.set_updated_at();

drop trigger if exists trg_reporter_directory_updated_at on public.reporter_directory;
create trigger trg_reporter_directory_updated_at
before update on public.reporter_directory
for each row execute function public.set_updated_at();

drop trigger if exists trg_reporter_directory_sync_name on public.reporter_directory;
create trigger trg_reporter_directory_sync_name
before insert or update of full_name on public.reporter_directory
for each row execute function public.sync_reporter_directory_name();

drop trigger if exists trg_report_templates_updated_at on public.report_templates;
create trigger trg_report_templates_updated_at
before update on public.report_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_report_template_approvers_updated_at on public.report_template_approvers;
create trigger trg_report_template_approvers_updated_at
before update on public.report_template_approvers
for each row execute function public.set_updated_at();

drop trigger if exists trg_excel_report_templates_updated_at on public.excel_report_templates;
create trigger trg_excel_report_templates_updated_at
before update on public.excel_report_templates
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_reports_updated_at on public.daily_reports;
create trigger trg_daily_reports_updated_at
before update on public.daily_reports
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_report_activities_updated_at on public.daily_report_activities;
create trigger trg_daily_report_activities_updated_at
before update on public.daily_report_activities
for each row execute function public.set_updated_at();

drop trigger if exists trg_daily_report_activity_photos_updated_at on public.daily_report_activity_photos;
create trigger trg_daily_report_activity_photos_updated_at
before update on public.daily_report_activity_photos
for each row execute function public.set_updated_at();

drop trigger if exists trg_enforce_activity_photo_limit on public.daily_report_activity_photos;
create trigger trg_enforce_activity_photo_limit
before insert or update of activity_id on public.daily_report_activity_photos
for each row execute function public.enforce_activity_photo_limit();

drop trigger if exists trg_daily_reports_sync_fields on public.daily_reports;
create trigger trg_daily_reports_sync_fields
before insert or update of reporter_name, display_date_text, report_date on public.daily_reports
for each row execute function public.sync_daily_report_fields();

drop trigger if exists trg_daily_reports_audit on public.daily_reports;
create trigger trg_daily_reports_audit
after insert or update or delete on public.daily_reports
for each row execute function public.log_daily_report_changes();

-- --------------------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) & KEBIJAKAN AKSES TABEL
-- --------------------------------------------------------------------------------------

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

-- Policies: admin_profiles [009]
drop policy if exists "authenticated users can read own admin profile" on public.admin_profiles;
create policy "authenticated users can read own admin profile"
on public.admin_profiles for select to authenticated
using (id = auth.uid() and is_active = true);

drop policy if exists "active admins can read admin_profiles" on public.admin_profiles;
create policy "active admins can read admin_profiles"
on public.admin_profiles for select to authenticated
using (public.is_admin());

-- Policies: reporter_directory [011, 020]
drop policy if exists "admin manage reporter_directory" on public.reporter_directory;
create policy "admin manage reporter_directory"
on public.reporter_directory for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "public read reporter_directory" on public.reporter_directory;
create policy "public read reporter_directory"
on public.reporter_directory for select to anon, authenticated
using (is_active = true);

-- Proteksi keamanan kolom password: hanya kolom non-kredensial yang dapat di-select langsung [020]
revoke select on public.reporter_directory from anon, authenticated;
grant select (id, full_name, normalized_name, unit_name, first_reported_at, last_reported_at, total_reports, is_active, created_at, updated_at) on public.reporter_directory to anon, authenticated;

-- Policies: report_templates & report_template_notes
drop policy if exists "admin manage report_templates" on public.report_templates;
create policy "admin manage report_templates"
on public.report_templates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read active templates" on public.report_templates;
create policy "read active templates"
on public.report_templates for select to anon, authenticated
using (is_active = true);

drop policy if exists "admin manage template notes" on public.report_template_notes;
create policy "admin manage template notes"
on public.report_template_notes for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read active template notes" on public.report_template_notes;
create policy "read active template notes"
on public.report_template_notes for select to anon, authenticated
using (
  exists (
    select 1 from public.report_templates rt
    where rt.id = report_template_notes.template_id and rt.is_active = true
  )
);

-- Policies: report_template_approvers [013]
drop policy if exists "admin manage template approvers" on public.report_template_approvers;
create policy "admin manage template approvers"
on public.report_template_approvers for all to authenticated
using (public.is_admin()) with check (public.is_admin());

drop policy if exists "read active template approvers" on public.report_template_approvers;
create policy "read active template approvers"
on public.report_template_approvers for select to anon, authenticated
using (
  is_active = true and exists (
    select 1 from public.report_templates rt
    where rt.id = report_template_approvers.template_id and rt.is_active = true
  )
);

-- Policies: excel_report_templates [012]
drop policy if exists "public read active excel_report_templates" on public.excel_report_templates;
create policy "public read active excel_report_templates"
on public.excel_report_templates for select to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "admin manage excel_report_templates" on public.excel_report_templates;
create policy "admin manage excel_report_templates"
on public.excel_report_templates for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Policies: daily_reports [007]
drop policy if exists "public read daily_reports" on public.daily_reports;
create policy "public read daily_reports"
on public.daily_reports for select to anon, authenticated
using (true);

drop policy if exists "public create reports on allowed dates" on public.daily_reports;
create policy "public create reports on allowed dates"
on public.daily_reports for insert to anon, authenticated
with check (public.is_public_report_date_allowed(report_date) or public.is_admin());

drop policy if exists "public update reports on allowed dates" on public.daily_reports;
create policy "public update reports on allowed dates"
on public.daily_reports for update to anon, authenticated
using (public.is_public_report_date_allowed(report_date) or public.is_admin())
with check (public.is_public_report_date_allowed(report_date) or public.is_admin());

drop policy if exists "admin delete all daily_reports" on public.daily_reports;
create policy "admin delete all daily_reports"
on public.daily_reports for delete to authenticated
using (public.is_admin());

-- Policies: daily_report_activities [007]
drop policy if exists "public read daily_report_activities" on public.daily_report_activities;
create policy "public read daily_report_activities"
on public.daily_report_activities for select to anon, authenticated
using (
  exists (
    select 1 from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
  )
);

drop policy if exists "public manage activities on allowed dates" on public.daily_report_activities;
create policy "public manage activities on allowed dates"
on public.daily_report_activities for all to anon, authenticated
using (
  exists (
    select 1 from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
      and (public.is_public_report_date_allowed(dr.report_date) or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.daily_reports dr
    where dr.id = daily_report_activities.report_id
      and (public.is_public_report_date_allowed(dr.report_date) or public.is_admin())
  )
);

-- Policies: daily_report_activity_photos [001, 008]
drop policy if exists "public read daily_report_activity_photos" on public.daily_report_activity_photos;
create policy "public read daily_report_activity_photos"
on public.daily_report_activity_photos for select to anon, authenticated
using (
  exists (
    select 1 from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
  )
);

drop policy if exists "public manage activity photos on allowed dates" on public.daily_report_activity_photos;
create policy "public manage activity photos on allowed dates"
on public.daily_report_activity_photos for all to anon, authenticated
using (
  exists (
    select 1 from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
      and (public.is_public_report_date_allowed(dr.report_date) or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.daily_report_activities dra
    join public.daily_reports dr on dr.id = dra.report_id
    where dra.id = daily_report_activity_photos.activity_id
      and (public.is_public_report_date_allowed(dr.report_date) or public.is_admin())
  )
);

-- Policies: daily_report_audit_logs [010]
drop policy if exists "admin read audit logs" on public.daily_report_audit_logs;
create policy "admin read audit logs"
on public.daily_report_audit_logs for select to authenticated
using (public.is_admin());

drop policy if exists "system append audit logs" on public.daily_report_audit_logs;
create policy "system append audit logs"
on public.daily_report_audit_logs for insert to anon, authenticated
with check (true);

-- Policies: app_settings
drop policy if exists "admin manage app_settings" on public.app_settings;
create policy "admin manage app_settings"
on public.app_settings for all to authenticated
using (public.is_admin()) with check (public.is_admin());

-- --------------------------------------------------------------------------------------
-- 7. STORAGE BUCKETS & STORAGE POLICIES
-- --------------------------------------------------------------------------------------

-- Bucket: daily-report-proofs (Foto Bukti Aktivitas) [001]
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
on storage.objects for select to public
using (bucket_id = 'daily-report-proofs');

drop policy if exists "public upload proof objects" on storage.objects;
create policy "public upload proof objects"
on storage.objects for insert to public
with check (bucket_id = 'daily-report-proofs');

drop policy if exists "public update proof objects" on storage.objects;
create policy "public update proof objects"
on storage.objects for update to public
using (bucket_id = 'daily-report-proofs')
with check (bucket_id = 'daily-report-proofs');

drop policy if exists "public delete proof objects" on storage.objects;
create policy "public delete proof objects"
on storage.objects for delete to public
using (bucket_id = 'daily-report-proofs');

-- Bucket: report-excel-templates (File Master Template Excel) [012]
insert into storage.buckets (id, name, public)
values ('report-excel-templates', 'report-excel-templates', true)
on conflict (id) do update
set public = true;

drop policy if exists "public read report excel templates" on storage.objects;
create policy "public read report excel templates"
on storage.objects for select to anon, authenticated
using (bucket_id = 'report-excel-templates');

drop policy if exists "admin upload report excel templates" on storage.objects;
create policy "admin upload report excel templates"
on storage.objects for insert to authenticated
with check (bucket_id = 'report-excel-templates' and public.is_admin());

drop policy if exists "admin update report excel templates" on storage.objects;
create policy "admin update report excel templates"
on storage.objects for update to authenticated
using (bucket_id = 'report-excel-templates' and public.is_admin())
with check (bucket_id = 'report-excel-templates' and public.is_admin());

drop policy if exists "admin delete report excel templates" on storage.objects;
create policy "admin delete report excel templates"
on storage.objects for delete to authenticated
using (bucket_id = 'report-excel-templates' and public.is_admin());

-- --------------------------------------------------------------------------------------
-- 8. PERMISSIONS & GRANTS
-- --------------------------------------------------------------------------------------
grant execute on function public.is_admin() to anon, authenticated;
grant execute on function public.current_max_photos_per_activity() to anon, authenticated;
grant execute on function public.is_public_report_date_allowed(date) to anon, authenticated;
grant execute on function public.get_report_rules() to anon, authenticated;
grant execute on function public.get_notification_settings() to anon, authenticated;
grant execute on function public.upsert_reporter_directory_for_report(text) to anon, authenticated;
grant execute on function public.rename_reporter_directory_profile(uuid, text) to authenticated;
grant execute on function public.delete_reporter_directory_trace(uuid) to authenticated;
grant execute on function public.set_active_excel_report_template(uuid) to authenticated;
grant execute on function public.authenticate_reporter(text, text) to anon, authenticated;
grant execute on function public.register_reporter(text, text) to anon, authenticated;
grant execute on function public.update_reporter_profile(uuid, text, text) to anon, authenticated;
grant execute on function public.admin_get_reporter_passwords() to authenticated;

-- --------------------------------------------------------------------------------------
-- 9. DATA AWAL (SEED & MASTER DATA) TERBARU
-- --------------------------------------------------------------------------------------

-- 9.1. Template Laporan Utama [002]
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
    'activity_fields', jsonb_build_array('no', 'detail_aktivitas', 'jam_mulai', 'jam_selesai', 'foto_bukti'),
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

-- 9.2. Catatan Footer Template
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

-- 9.3. Pejabat Penandatangan Default (TRC, PUSDALOPS, & KABID) [013, 018]
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
      'coordinator_team_trc',
      'KOORDINATOR',
      'RIKI',
      null,
      '198607082016041001'
    ),
    (
      'coordinator_team_pusdalops',
      'KOORDINATOR',
      'MOH. YASIR SYURIADI N.',
      null,
      '197309181993031004'
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

-- 9.4. Pengaturan Sistem Aplikasi [004, 007, 014, 016, 021]
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
      'max_photos_per_activity', 1,
      'system_start_date', '2026-01-01'
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

-- Sinkronisasi dynamic system_start_date jika sudah ada data laporan [021]
update public.app_settings
set value = value || jsonb_build_object(
  'system_start_date',
  coalesce(
    value->>'system_start_date',
    (select min(report_date)::text from public.daily_reports),
    to_char(now() at time zone 'Asia/Makassar', 'YYYY-MM-DD')
  )
),
updated_at = now()
where key = 'report_rules';

-- 9.5. Backfill Laporan Lama ke Template & Pejabat Penandatangan Default [013]
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
  and ta.approver_role = case
    when upper(dr.tim) = 'TRC' then 'coordinator_team_trc'
    else 'coordinator_team_pusdalops'
  end
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

-- 9.6. Daftar Petugas / Pelapor Awal (Reporter Directory Seed) [022]
insert into public.reporter_directory (
  full_name,
  normalized_name,
  password,
  is_active
)
select
  public.format_reporter_name(name_list.raw_name) as full_name,
  public.normalize_name(name_list.raw_name) as normalized_name,
  '123123123' as password,
  true as is_active
from (
  values
    ('M. AGUNG FIKRIANSYAH, S.Kom'),
    ('FIA YUNIAR ILCHAM, S.Ak'),
    ('FEBY APRILYANDINI, S.I.Kom'),
    ('UMMU NUR DINIYAH'),
    ('ANDI IMRAN'),
    ('MUHAMMAD AYNUN NAWIR, S.Pd'),
    ('ANDIKA'),
    ('ARISANDI'),
    ('ASTAR'),
    ('BAMBANG ADYTIA SAPUTRA SIREGAR, S.H'),
    ('DELIYANA'),
    ('DIMAS, S.pd'),
    ('Ditry Rosaline'),
    ('ELMA RESITHA,SE'),
    ('GAYUH LAKSONO, S.Kom'),
    ('Hari Prasetya'),
    ('JAMALUDIN KASIM'),
    ('Julpan sukon'),
    ('M FAHRIL, S.Kom.'),
    ('Mahfud'),
    ('MIRANDA, S.Agr'),
    ('MOH ARFAN'),
    ('MOH RIAN FEBRIAN'),
    ('MOH. FAHRUL'),
    ('Moh. Rizky, SH'),
    ('MUH. AIMHAQ SYAFA''AT AL IDRUS, S.P'),
    ('MUHAMMAD FADHIL AKMAL B. PALOLOANG, S.KOM.'),
    ('NASRULLAH ADYAKSA MALONDA, S.I.Kom'),
    ('Nawal silka'),
    ('Rahmat'),
    ('SAFRUDIN M KASIM'),
    ('TRI JUNIANTI NURQADRI,S.Pd'),
    ('TRI KRAMA, S. KOM')
) as name_list(raw_name)
on conflict (normalized_name) do update
set full_name = excluded.full_name,
    is_active = true,
    updated_at = now();

-- 9.7. Akun Administrator Default (Admin Profile Seed) [023]
-- Email: admin@bpbd.com | Password: admin123
do $$
declare
  new_admin_id uuid;
  admin_email_input text := 'admin@bpbd.com';
  admin_password_input text := 'admin123';
  admin_name_input text := 'Administrator SiLahar';
begin
  select id into new_admin_id
  from auth.users
  where email = admin_email_input;

  if new_admin_id is null then
    new_admin_id := gen_random_uuid();

    insert into auth.users (
      id,
      instance_id,
      aud,
      role,
      email,
      encrypted_password,
      email_confirmed_at,
      raw_app_meta_data,
      raw_user_meta_data,
      created_at,
      updated_at,
      confirmation_token,
      email_change,
      email_change_token_new,
      recovery_token
    )
    values (
      new_admin_id,
      '00000000-0000-0000-0000-000000000000',
      'authenticated',
      'authenticated',
      admin_email_input,
      crypt(admin_password_input, gen_salt('bf')),
      now(),
      '{"provider": "email", "providers": ["email"]}'::jsonb,
      jsonb_build_object('full_name', admin_name_input),
      now(),
      now(),
      '',
      '',
      '',
      ''
    );

    if exists (
      select 1 from information_schema.tables 
      where table_schema = 'auth' and table_name = 'identities'
    ) then
      insert into auth.identities (
        id,
        user_id,
        identity_data,
        provider,
        provider_id,
        last_sign_in_at,
        created_at,
        updated_at
      )
      values (
        new_admin_id,
        new_admin_id,
        jsonb_build_object('sub', new_admin_id::text, 'email', admin_email_input),
        'email',
        new_admin_id::text,
        now(),
        now(),
        now()
      )
      on conflict (provider, provider_id) do nothing;
    end if;
  else
    update auth.users
    set encrypted_password = crypt(admin_password_input, gen_salt('bf')),
        email_confirmed_at = coalesce(email_confirmed_at, now()),
        updated_at = now()
    where id = new_admin_id;
  end if;

  insert into public.admin_profiles (
    id,
    full_name,
    role,
    is_active,
    created_at,
    updated_at
  )
  values (
    new_admin_id,
    admin_name_input,
    'admin',
    true,
    now(),
    now()
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      role = excluded.role,
      is_active = true,
      updated_at = now();

end $$;


