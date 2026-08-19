-- 1. Add 'tim' column to daily_reports
ALTER TABLE public.daily_reports
ADD COLUMN if not exists tim text not null default 'PUSDALOPS';

-- 2. Drop the old check constraint on approver_role
DO $$
DECLARE
    const_name text;
BEGIN
    SELECT conname INTO const_name
    FROM pg_constraint
    WHERE conrelid = 'public.report_template_approvers'::regclass
      AND contype = 'c'
      AND pg_get_constraintdef(oid) LIKE '%approver_role%';
      
    IF const_name IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.report_template_approvers DROP CONSTRAINT ' || const_name;
    END IF;
END $$;

-- 3. Update existing 'coordinator_team' roles to 'coordinator_team_trc'
UPDATE public.report_template_approvers
SET approver_role = 'coordinator_team_trc'
WHERE approver_role = 'coordinator_team';

-- 4. Add the new check constraint with all three roles
ALTER TABLE public.report_template_approvers
ADD CONSTRAINT report_template_approvers_approver_role_check 
CHECK (approver_role IN ('coordinator_team_trc', 'coordinator_team_pusdalops', 'division_head'));

-- 5. Insert default PUSDALOPS coordinator (similar to TRC but distinct role)
INSERT INTO public.report_template_approvers (
  template_id,
  approver_role,
  scope_label,
  official_name,
  official_title,
  official_nip,
  is_active
)
SELECT
  rt.id,
  'coordinator_team_pusdalops',
  'KOORDINATOR PUSDALOPS',
  'ARIS PEBRIANSYAH, S.STP, M.AP', -- Assuming same name for now, admin can change it later
  null,
  '199602102018081001',
  true
FROM public.report_templates rt
WHERE rt.template_code = 'bpbd-trc-harian-2026'
ON CONFLICT (template_id, approver_role) DO NOTHING;
