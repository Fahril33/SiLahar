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
