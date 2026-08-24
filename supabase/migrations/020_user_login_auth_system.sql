-- 1. Add password column
alter table public.reporter_directory
add column if not exists password text not null default '123123123';

-- 2. Revoke and Grant column-level privileges for security
revoke select on public.reporter_directory from anon, authenticated;
grant select (id, full_name, normalized_name, unit_name, first_reported_at, last_reported_at, total_reports, is_active, created_at, updated_at) on public.reporter_directory to anon, authenticated;

-- 3. Create authenticate_reporter function
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

grant execute on function public.authenticate_reporter(text, text) to anon, authenticated;

-- 4. Create register_reporter function
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

grant execute on function public.register_reporter(text, text) to anon, authenticated;

-- 5. Create update_reporter_profile function
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

grant execute on function public.update_reporter_profile(uuid, text, text) to anon, authenticated;

-- 6. Create admin_get_reporter_passwords function
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

grant execute on function public.admin_get_reporter_passwords() to authenticated;
