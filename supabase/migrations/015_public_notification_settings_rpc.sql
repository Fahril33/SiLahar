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

grant execute on function public.get_notification_settings() to anon, authenticated;
