-- ============================================================================
-- Migration: 026_add_team_type_coordinators.sql
-- Description: Add customizable coordinator official details (coordinator_name,
--              coordinator_nip, coordinator_label) per Team Type.
-- ============================================================================

-- 1. Add coordinator columns to team_types table if missing
ALTER TABLE public.team_types
ADD COLUMN IF NOT EXISTS coordinator_name TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS coordinator_nip TEXT DEFAULT '',
ADD COLUMN IF NOT EXISTS coordinator_label TEXT DEFAULT '';

-- 2. Update get_team_types RPC function to include coordinator columns
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
  is_default BOOLEAN,
  is_active BOOLEAN,
  created_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT id, code, name, description, header_lines, coordinator_name, coordinator_nip, coordinator_label, is_default, is_active, created_at, updated_at
  FROM public.team_types
  WHERE is_active = true
  ORDER BY is_default DESC, name ASC;
$$;

-- 3. Drop all previous overloads of upsert_team_type to prevent signature ambiguity in RPC
DROP FUNCTION IF EXISTS public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, BOOLEAN);
DROP FUNCTION IF EXISTS public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, BOOLEAN);

-- 4. Create updated upsert_team_type RPC function with coordinator parameters
CREATE OR REPLACE FUNCTION public.upsert_team_type(
  p_id TEXT,
  p_code TEXT,
  p_name TEXT,
  p_description TEXT,
  p_header_lines JSONB,
  p_coordinator_name TEXT DEFAULT '',
  p_coordinator_nip TEXT DEFAULT '',
  p_coordinator_label TEXT DEFAULT '',
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

  -- Resolve existing ID by ID or CODE first to prevent duplicate key constraint on code
  SELECT id INTO v_id 
  FROM public.team_types 
  WHERE id = trim(COALESCE(p_id, '')) OR code = v_code 
  LIMIT 1;

  IF v_id IS NULL THEN
    v_id := COALESCE(NULLIF(trim(p_id), ''), 'team-type-' || extract(epoch from now())::bigint || '-' || floor(random() * 1000)::text);
  END IF;

  -- If setting as default, clear previous default flag
  IF p_is_default = true THEN
    UPDATE public.team_types SET is_default = false WHERE id <> v_id;
  END IF;

  INSERT INTO public.team_types (id, code, name, description, header_lines, coordinator_name, coordinator_nip, coordinator_label, is_default, is_active, updated_at)
  VALUES (
    v_id,
    v_code,
    trim(p_name),
    COALESCE(trim(p_description), ''),
    COALESCE(p_header_lines, '["LAPORAN HARIAN KINERJA", "BADAN PENANGGULANGAN BENCANA DAERAH PROVINSI SULAWESI TENGAH", "TAHUN ANGGARAN 2026"]'::jsonb),
    COALESCE(trim(p_coordinator_name), ''),
    COALESCE(trim(p_coordinator_nip), ''),
    COALESCE(trim(p_coordinator_label), ''),
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
    coordinator_name = EXCLUDED.coordinator_name,
    coordinator_nip = EXCLUDED.coordinator_nip,
    coordinator_label = EXCLUDED.coordinator_label,
    is_default = EXCLUDED.is_default,
    is_active = true,
    updated_at = timezone('utc'::text, now())
  RETURNING * INTO v_result;

  RETURN v_result;
END;
$$;

-- Grant permissions to public roles
GRANT SELECT ON public.team_types TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_team_types() TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.upsert_team_type(TEXT, TEXT, TEXT, TEXT, JSONB, TEXT, TEXT, TEXT, BOOLEAN) TO authenticated, service_role;
