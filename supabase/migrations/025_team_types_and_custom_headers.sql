-- ============================================================================
-- Migration: 025_team_types_and_custom_headers.sql
-- Description: Dynamic Team Types Division with Modular Kop Laporan (Header Lines)
--              configured per Team Type, and Signatories settings.
-- ============================================================================

-- 1. Ensure header_lines column exists on report_templates table for backward compatibility
ALTER TABLE public.report_templates
ADD COLUMN IF NOT EXISTS header_lines JSONB NOT NULL DEFAULT '["LAPORAN HARIAN KINERJA TIM REAKSI CEPAT", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb;

-- 2. Create team_types table if not exists
CREATE TABLE IF NOT EXISTS public.team_types (
  id TEXT PRIMARY KEY,
  code TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  header_lines JSONB NOT NULL DEFAULT '["LAPORAN HARIAN KINERJA TIM REAKSI CEPAT", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb,
  is_default BOOLEAN DEFAULT false,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 3. Add team_type_id to report_templates and report_template_approvers if missing
ALTER TABLE public.report_templates
ADD COLUMN IF NOT EXISTS team_type_id TEXT REFERENCES public.team_types(id) ON DELETE SET NULL;

ALTER TABLE public.report_template_approvers
ADD COLUMN IF NOT EXISTS team_type_id TEXT REFERENCES public.team_types(id) ON DELETE SET NULL;

-- 4. Enable RLS on team_types
ALTER TABLE public.team_types ENABLE ROW LEVEL SECURITY;

-- Drop old policies if existing to avoid conflict
DROP POLICY IF EXISTS "Public read team_types" ON public.team_types;
DROP POLICY IF EXISTS "Admin modify team_types" ON public.team_types;

CREATE POLICY "Public read team_types"
  ON public.team_types
  FOR SELECT
  USING (true);

CREATE POLICY "Admin modify team_types"
  ON public.team_types
  FOR ALL
  USING (
    auth.role() = 'authenticated' OR auth.role() = 'service_role'
  );

-- 5. Seed default Team Types with custom Kop Laporan per Team Type
INSERT INTO public.team_types (id, code, name, description, header_lines, is_default, is_active)
VALUES
  (
    'team-type-trc-default',
    'trc',
    'Tim Reaksi Cepat (TRC)',
    'Tim lapangan tanggap darurat dan kejadian bencana',
    '["LAPORAN HARIAN KINERJA TIM REAKSI CEPAT", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb,
    true,
    true
  ),
  (
    'team-type-pusdalops-default',
    'pusdalops',
    'Pusat Pengendalian Operasi (PUSDALOPS)',
    'Tim pemantauan, analisis data, dan koordinasi informasi bencana',
    '["LAPORAN HARIAN KINERJA PUSDALOPS", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb,
    false,
    true
  )
ON CONFLICT (code) DO UPDATE
SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  header_lines = EXCLUDED.header_lines,
  updated_at = timezone('utc'::text, now());

-- Update active default report template with default header lines
UPDATE public.report_templates
SET
  header_lines = '["LAPORAN HARIAN KINERJA TIM REAKSI CEPAT", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb,
  team_type_id = 'team-type-trc-default'
WHERE is_active = true AND (header_lines IS NULL OR jsonb_array_length(header_lines) = 0);

-- 6. Helper RPC Function to get active Team Types
CREATE OR REPLACE FUNCTION public.get_team_types()
RETURNS TABLE (
  id TEXT,
  code TEXT,
  name TEXT,
  description TEXT,
  header_lines JSONB,
  is_default BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, code, name, description, header_lines, is_default, is_active, created_at, updated_at
  FROM public.team_types
  WHERE is_active = true
  ORDER BY is_default DESC, name ASC;
$$;

-- 7. Helper RPC Function to Upsert Team Type
CREATE OR REPLACE FUNCTION public.upsert_team_type(
  p_id TEXT,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_header_lines JSONB,
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
  v_id := COALESCE(NULLIF(trim(p_id), ''), 'team-type-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::text);
  v_code := lower(trim(p_code));

  -- If setting as default, clear previous default flag
  IF p_is_default = true THEN
    UPDATE public.team_types SET is_default = false WHERE id <> v_id;
  END IF;

  INSERT INTO public.team_types (id, code, name, description, header_lines, is_default, is_active, updated_at)
  VALUES (
    v_id,
    v_code,
    trim(p_name),
    COALESCE(trim(p_description), ''),
    COALESCE(p_header_lines, '["LAPORAN HARIAN KINERJA", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb),
    COALESCE(p_is_default, false),
    true,
    timezone('utc'::text, now())
  )
  ON CONFLICT (id) DO UPDATE
  SET
    code = EXCLUDED.code,
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    header_lines = EXCLUDED.header_lines,
    is_default = EXCLUDED.is_default,
    is_active = true,
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- 8. Helper RPC Function to Update Team Type Header Lines
CREATE OR REPLACE FUNCTION public.update_team_type_headers(
  p_team_type_id TEXT,
  p_header_lines JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.team_types
  SET
    header_lines = COALESCE(p_header_lines, '[]'::jsonb),
    updated_at = timezone('utc'::text, now())
  WHERE id = p_team_type_id OR code = lower(trim(p_team_type_id));
END;
$$;

-- 9. Helper RPC Function to Soft Delete Team Type
CREATE OR REPLACE FUNCTION public.delete_team_type(
  p_id TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Prevent deletion of default team type
  IF EXISTS (SELECT 1 FROM public.team_types WHERE id = p_id AND is_default = true) THEN
    RAISE EXCEPTION 'Jenis tim utama (default) tidak dapat dihapus.';
  END IF;

  UPDATE public.team_types
  SET
    is_active = false,
    updated_at = timezone('utc'::text, now())
  WHERE id = p_id;
END;
$$;

-- Grant permissions to public roles
GRANT SELECT ON public.team_types TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_types() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_team_type_headers(TEXT, JSONB) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_team_type(TEXT) TO authenticated, service_role;
