insert into public.app_settings (key, value)
values (
  'report_rules',
  jsonb_build_object(
    'max_photos_per_activity', 1
  )
)
on conflict (key) do update
set value = jsonb_set(
      coalesce(public.app_settings.value, '{}'::jsonb),
      '{max_photos_per_activity}',
      to_jsonb(greatest(1, coalesce((public.app_settings.value->>'max_photos_per_activity')::int, 1))),
      true
    ),
    updated_at = now();

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
returns table (max_photos_per_activity integer)
language sql
stable
security definer
set search_path = public
as $$
  select public.current_max_photos_per_activity() as max_photos_per_activity;
$$;

grant execute on function public.current_max_photos_per_activity() to anon, authenticated;
grant execute on function public.get_report_rules() to anon, authenticated;

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

drop trigger if exists trg_enforce_activity_photo_limit on public.daily_report_activity_photos;
create trigger trg_enforce_activity_photo_limit
before insert or update of activity_id on public.daily_report_activity_photos
for each row
execute function public.enforce_activity_photo_limit();
