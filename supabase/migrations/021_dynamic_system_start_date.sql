-- Migration: Add dynamic system_start_date to report_rules
-- This replaces the hardcoded SYSTEM_START_DATE constant in the frontend.
-- Admin can now configure the operational start date from the dashboard.

UPDATE public.app_settings
SET value = value || jsonb_build_object(
  'system_start_date',
  coalesce(
    value->>'system_start_date',
    (SELECT min(report_date)::text FROM public.daily_reports),
    to_char(now() at time zone 'Asia/Makassar', 'YYYY-MM-DD')
  )
),
updated_at = now()
WHERE key = 'report_rules';
