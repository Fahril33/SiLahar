-- ======================================================================================
-- Migration 028: Media Migration RPC & Photo Storage Binding Policy
-- ======================================================================================
-- Memastikan migrasi foto aktivitas dan tanda tangan dari Supabase lama ke baru
-- berjalan mulus tanpa terhalang RLS tanggal lampau, serta mempertahankan relasi ketat.
-- ======================================================================================

-- 1. Fungsi RPC Berkeamanan Penuh (SECURITY DEFINER) untuk Upsert Foto Aktivitas
CREATE OR REPLACE FUNCTION public.upsert_daily_report_activity_photo(
  photo_id uuid,
  photo_activity_id uuid,
  photo_storage_path text,
  photo_public_url text,
  photo_original_file_name text,
  photo_sort_order integer DEFAULT 1
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_id uuid;
BEGIN
  IF photo_activity_id IS NULL THEN
    RAISE EXCEPTION 'ID Aktivitas (activity_id) wajib diisi untuk relasi foto.';
  END IF;

  IF photo_storage_path IS NULL OR trim(photo_storage_path) = '' THEN
    RAISE EXCEPTION 'Storage path foto tidak boleh kosong.';
  END IF;

  INSERT INTO public.daily_report_activity_photos (
    id,
    activity_id,
    storage_path,
    public_url,
    original_file_name,
    sort_order,
    created_at,
    updated_at
  )
  VALUES (
    COALESCE(photo_id, gen_random_uuid()),
    photo_activity_id,
    photo_storage_path,
    photo_public_url,
    COALESCE(photo_original_file_name, 'photo.jpg'),
    COALESCE(photo_sort_order, 1),
    now(),
    now()
  )
  ON CONFLICT (storage_path) DO UPDATE
  SET activity_id = EXCLUDED.activity_id,
      public_url = EXCLUDED.public_url,
      original_file_name = EXCLUDED.original_file_name,
      sort_order = EXCLUDED.sort_order,
      updated_at = now()
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_daily_report_activity_photo(uuid, uuid, text, text, text, integer) TO anon, authenticated;

-- 2. Fungsi RPC Berkeamanan Penuh (SECURITY DEFINER) untuk Upsert Aktivitas Laporan
CREATE OR REPLACE FUNCTION public.upsert_daily_report_activity(
  act_id uuid,
  act_report_id uuid,
  act_activity_order integer DEFAULT 1,
  act_description text DEFAULT 'Aktivitas Dokumentasi Lapangan',
  act_start_time text DEFAULT '08:00',
  act_end_time text DEFAULT '16:00'
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result_id uuid;
  assigned_order integer;
BEGIN
  IF act_report_id IS NULL THEN
    RAISE EXCEPTION 'ID Laporan (report_id) wajib diisi untuk relasi aktivitas.';
  END IF;

  -- Jika aktivitas dengan ID ini sudah ada di database, gunakan data yang ada
  SELECT id INTO result_id
  FROM public.daily_report_activities
  WHERE id = act_id;

  IF result_id IS NOT NULL THEN
    RETURN result_id;
  END IF;

  -- Pastikan activity_order tidak bentrok pada report_id yang sama
  assigned_order := COALESCE(act_activity_order, 1);
  IF EXISTS (
    SELECT 1 FROM public.daily_report_activities
    WHERE report_id = act_report_id AND activity_order = assigned_order
  ) THEN
    SELECT COALESCE(MAX(activity_order), 0) + 1 INTO assigned_order
    FROM public.daily_report_activities
    WHERE report_id = act_report_id;
  END IF;

  INSERT INTO public.daily_report_activities (
    id,
    report_id,
    activity_order,
    activity_description,
    start_time_text,
    end_time_text
  )
  VALUES (
    COALESCE(act_id, gen_random_uuid()),
    act_report_id,
    assigned_order,
    COALESCE(act_description, 'Aktivitas Dokumentasi Lapangan'),
    COALESCE(act_start_time, '08:00'),
    COALESCE(act_end_time, '16:00')
  )
  ON CONFLICT (id) DO UPDATE
  SET report_id = EXCLUDED.report_id,
      activity_description = EXCLUDED.activity_description,
      start_time_text = EXCLUDED.start_time_text,
      end_time_text = EXCLUDED.end_time_text
  RETURNING id INTO result_id;

  RETURN result_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.upsert_daily_report_activity(uuid, uuid, integer, text, text, text) TO anon, authenticated;

-- 3. Kebijakan RLS Langsung: Izinkan Akses Penuh bagi Pengguna Authenticated
DROP POLICY IF EXISTS "authenticated manage all activity photos" ON public.daily_report_activity_photos;
CREATE POLICY "authenticated manage all activity photos"
ON public.daily_report_activity_photos
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated manage all activities" ON public.daily_report_activities;
CREATE POLICY "authenticated manage all activities"
ON public.daily_report_activities
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "authenticated manage all daily reports" ON public.daily_reports;
CREATE POLICY "authenticated manage all daily reports"
ON public.daily_reports
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 4. Aktifkan Izin Tanggal Bebas di app_settings agar tanggal historis selalu diizinkan
UPDATE public.app_settings
SET value = jsonb_set(
  COALESCE(value, '{}'::jsonb),
  '{allow_any_report_date}',
  'true'::jsonb,
  true
),
updated_at = now()
WHERE key = 'report_rules';
