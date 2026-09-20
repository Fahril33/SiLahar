-- ============================================================================
-- Migration: 027_add_signatures_to_team_types_and_approvers.sql
-- Description: Add signature_url column to team_types and
--              report_template_approvers tables, configure official-signatures
--              and daily-report-proofs storage buckets with RLS policies,
--              and update related RPC functions.
-- ============================================================================

-- 1. Add signature_url column to team_types if missing
ALTER TABLE public.team_types
ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT '';

-- 2. Add signature_url column to report_template_approvers if missing
ALTER TABLE public.report_template_approvers
ADD COLUMN IF NOT EXISTS signature_url TEXT DEFAULT '';

-- 3. Storage Bucket: official-signatures
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'official-signatures',
  'official-signatures',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- Storage Bucket: daily-report-proofs (ensure it exists)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'daily-report-proofs',
  'daily-report-proofs',
  true,
  5242880,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml']
)
ON CONFLICT (id) DO UPDATE
SET public = true,
    file_size_limit = 5242880,
    allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/svg+xml'];

-- Storage policies for official-signatures
DROP POLICY IF EXISTS "public read official signatures" ON storage.objects;
CREATE POLICY "public read official signatures"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'official-signatures');

DROP POLICY IF EXISTS "public upload official signatures" ON storage.objects;
CREATE POLICY "public upload official signatures"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'official-signatures');

DROP POLICY IF EXISTS "public update official signatures" ON storage.objects;
CREATE POLICY "public update official signatures"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'official-signatures')
WITH CHECK (bucket_id = 'official-signatures');

DROP POLICY IF EXISTS "public delete official signatures" ON storage.objects;
CREATE POLICY "public delete official signatures"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'official-signatures');

-- Storage policies for daily-report-proofs
DROP POLICY IF EXISTS "public read proof objects" ON storage.objects;
CREATE POLICY "public read proof objects"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'daily-report-proofs');

DROP POLICY IF EXISTS "public upload proof objects" ON storage.objects;
CREATE POLICY "public upload proof objects"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'daily-report-proofs');

DROP POLICY IF EXISTS "public update proof objects" ON storage.objects;
CREATE POLICY "public update proof objects"
ON storage.objects FOR UPDATE
TO public
USING (bucket_id = 'daily-report-proofs')
WITH CHECK (bucket_id = 'daily-report-proofs');

DROP POLICY IF EXISTS "public delete proof objects" ON storage.objects;
CREATE POLICY "public delete proof objects"
ON storage.objects FOR DELETE
TO public
USING (bucket_id = 'daily-report-proofs');

-- 4. Update get_team_types RPC to include signature_url in returned columns
DROP FUNCTION IF EXISTS public.get_team_types();

CREATE OR REPLACE FUNCTION public.get_team_types()
RETURNS TABLE (
  id TEXT,
  code TEXT,
  name TEXT,
  description TEXT,
  header_lines JSONB,
  coordinator_name TEXT,
  coordinator_nip TEXT,
  coordinator_label TEXT,
  signature_url TEXT,
  is_default BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT
    id, code, name, description, header_lines,
    coordinator_name, coordinator_nip, coordinator_label,
    signature_url,
    is_default, is_active, created_at, updated_at
  FROM public.team_types
  WHERE is_active = true
  ORDER BY is_default DESC, name ASC;
$$;

-- 5. Drop all previous overloads of upsert_team_type to prevent ambiguity
DROP FUNCTION IF EXISTS public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, BOOLEAN);

-- 6. Create updated upsert_team_type RPC with signature_url parameter
CREATE OR REPLACE FUNCTION public.upsert_team_type(
  p_id TEXT,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_header_lines JSONB,
  p_coordinator_name TEXT DEFAULT '',
  p_coordinator_nip TEXT DEFAULT '',
  p_coordinator_label TEXT DEFAULT '',
  p_signature_url TEXT DEFAULT '',
  p_is_default BOOLEAN DEFAULT false
)
RETURNS public.team_types
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_result public.team_types;
  v_id TEXT;
  v_code TEXT;
BEGIN
  v_code := lower(trim(p_code));

  -- Resolve existing record by ID or CODE to prevent duplicate key conflicts
  SELECT t.id INTO v_id
  FROM public.team_types t
  WHERE t.id = trim(COALESCE(p_id, '')) OR t.code = v_code
  LIMIT 1;

  -- Generate a new ID if no existing record was found
  IF v_id IS NULL THEN
    v_id := COALESCE(
      NULLIF(trim(p_id), ''),
      'team-type-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::text
    );
  END IF;

  -- If setting this team type as default, clear the flag on all others
  IF p_is_default = true THEN
    UPDATE public.team_types SET is_default = false WHERE id <> v_id;
  END IF;

  INSERT INTO public.team_types (
    id, code, name, description, header_lines,
    coordinator_name, coordinator_nip, coordinator_label,
    signature_url,
    is_default, is_active, updated_at
  )
  VALUES (
    v_id,
    v_code,
    trim(p_name),
    COALESCE(trim(p_description), ''),
    COALESCE(p_header_lines, '["LAPORAN HARIAN KINERJA", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb),
    COALESCE(trim(p_coordinator_name), ''),
    COALESCE(trim(p_coordinator_nip), ''),
    COALESCE(trim(p_coordinator_label), ''),
    COALESCE(trim(p_signature_url), ''),
    COALESCE(p_is_default, false),
    true,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    code             = EXCLUDED.code,
    name             = EXCLUDED.name,
    description      = EXCLUDED.description,
    header_lines     = EXCLUDED.header_lines,
    coordinator_name = EXCLUDED.coordinator_name,
    coordinator_nip  = EXCLUDED.coordinator_nip,
    coordinator_label = EXCLUDED.coordinator_label,
    signature_url    = EXCLUDED.signature_url,
    is_default       = EXCLUDED.is_default,
    is_active        = true,
    updated_at       = timezone('utc'::text, now())
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 7. Grant permissions for updated functions and tables
GRANT SELECT, INSERT, UPDATE, DELETE ON public.team_types TO anon, authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.report_template_approvers TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_team_types() TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, TEXT, BOOLEAN) TO anon, authenticated, service_role;

