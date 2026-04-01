create or replace function public.upsert_reporter_directory_for_report(reporter_name_input text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  normalized_input text := public.normalize_name(reporter_name_input);
  uppercase_input text := upper(trim(coalesce(reporter_name_input, '')));
  existing_row public.reporter_directory%rowtype;
  now_value timestamptz := now();
begin
  if uppercase_input = '' then
    raise exception 'Nama pelapor wajib diisi.';
  end if;

  select *
  into existing_row
  from public.reporter_directory
  where normalized_name = normalized_input
  limit 1;

  if found then
    update public.reporter_directory
    set full_name = uppercase_input,
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
    uppercase_input,
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

grant execute on function public.upsert_reporter_directory_for_report(text) to anon, authenticated;
