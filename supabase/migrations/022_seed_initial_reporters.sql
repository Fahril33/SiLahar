-- ======================================================================================
-- Migration 022: Seed Initial Reporter Directory Names & Accounts
-- ======================================================================================

INSERT INTO public.reporter_directory (
  full_name,
  normalized_name,
  password,
  is_active
)
SELECT
  public.format_reporter_name(name_list.raw_name) AS full_name,
  public.normalize_name(name_list.raw_name) AS normalized_name,
  '123123123' AS password,
  true AS is_active
FROM (
  VALUES
    ('M. AGUNG FIKRIANSYAH, S.Kom'),
    ('FIA YUNIAR ILCHAM, S.Ak'),
    ('FEBY APRILYANDINI, S.I.Kom'),
    ('UMMU NUR DINIYAH'),
    ('ANDI IMRAN'),
    ('MUHAMMAD AYNUN NAWIR, S.Pd'),
    ('ANDIKA'),
    ('ARISANDI'),
    ('ASTAR'),
    ('BAMBANG ADYTIA SAPUTRA SIREGAR, S.H'),
    ('DELIYANA'),
    ('DIMAS, S.pd'),
    ('Ditry Rosaline'),
    ('ELMA RESITHA,SE'),
    ('GAYUH LAKSONO, S.Kom'),
    ('Hari Prasetya'),
    ('JAMALUDIN KASIM'),
    ('Julpan sukon'),
    ('M FAHRIL, S.Kom.'),
    ('Mahfud'),
    ('MIRANDA, S.Agr'),
    ('MOH ARFAN'),
    ('MOH RIAN FEBRIAN'),
    ('MOH. FAHRUL'),
    ('Moh. Rizky, SH'),
    ('MUH. AIMHAQ SYAFA''AT AL IDRUS, S.P'),
    ('MUHAMMAD FADHIL AKMAL B. PALOLOANG, S.KOM.'),
    ('NASRULLAH ADYAKSA MALONDA, S.I.Kom'),
    ('Nawal silka'),
    ('Rahmat'),
    ('SAFRUDIN M KASIM'),
    ('TRI JUNIANTI NURQADRI,S.Pd'),
    ('TRI KRAMA, S. KOM')
) AS name_list(raw_name)
ON CONFLICT (normalized_name) DO UPDATE
SET full_name = excluded.full_name,
    is_active = true,
    updated_at = now();
