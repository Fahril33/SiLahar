insert into public.app_settings (key, value)
values (
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
set value = public.app_settings.value || excluded.value,
    updated_at = now();
