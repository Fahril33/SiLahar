create or replace function public.format_reporter_name(value text)
returns text
language sql
immutable
as $$
  select regexp_replace(trim(coalesce(value, '')), '\s+', ' ', 'g');
$$;

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

  new.display_date_text = public.wita_display_date(new.report_date);

  return new;
end;
$$;

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

update public.reporter_directory
set full_name = public.format_reporter_name(full_name),
    normalized_name = public.normalize_name(full_name),
    updated_at = now()
where full_name <> public.format_reporter_name(full_name)
   or normalized_name <> public.normalize_name(full_name);

update public.daily_reports
set reporter_name = public.format_reporter_name(reporter_name),
    normalized_reporter_name = public.normalize_name(reporter_name),
    updated_at = now()
where reporter_name <> public.format_reporter_name(reporter_name)
   or normalized_reporter_name <> public.normalize_name(reporter_name);
