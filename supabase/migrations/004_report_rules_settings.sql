insert into public.app_settings (key, value)
values (
  'report_rules',
  jsonb_build_object(
    'max_photos_per_activity', 1
  )
)
on conflict (key) do update
set value = excluded.value,
    updated_at = now();
