create table if not exists public.report_template_approvers (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.report_templates(id) on delete cascade,
  approver_role text not null check (approver_role in ('coordinator_team', 'division_head')),
  scope_label text not null,
  official_name text not null,
  official_title text,
  official_nip text,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (template_id, approver_role)
);

create index if not exists idx_report_template_approvers_template_role
on public.report_template_approvers(template_id, approver_role);

drop trigger if exists trg_report_template_approvers_updated_at on public.report_template_approvers;
create trigger trg_report_template_approvers_updated_at
before update on public.report_template_approvers
for each row
execute function public.set_updated_at();

alter table public.report_template_approvers enable row level security;

drop policy if exists "read active template approvers" on public.report_template_approvers;
create policy "read active template approvers"
on public.report_template_approvers
for select
to anon, authenticated
using (
  is_active = true
  and exists (
    select 1
    from public.report_templates rt
    where rt.id = report_template_approvers.template_id
      and rt.is_active = true
  )
);

drop policy if exists "admin manage template approvers" on public.report_template_approvers;
create policy "admin manage template approvers"
on public.report_template_approvers
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

alter table public.daily_reports
add column if not exists template_approver_coordinator_id uuid references public.report_template_approvers(id) on delete set null;

alter table public.daily_reports
add column if not exists template_approver_division_head_id uuid references public.report_template_approvers(id) on delete set null;

insert into public.report_template_approvers (
  template_id,
  approver_role,
  scope_label,
  official_name,
  official_title,
  official_nip,
  is_active
)
select
  rt.id,
  approvers.approver_role,
  approvers.scope_label,
  approvers.official_name,
  approvers.official_title,
  approvers.official_nip,
  true
from public.report_templates rt
cross join (
  values
    (
      'coordinator_team',
      'KOORDINATOR TIM',
      'ARIS PEBRIANSYAH, S.STP, M.AP',
      null,
      '199602102018081001'
    ),
    (
      'division_head',
      'KEPALA BIDANG KEDARURATAN & LOGISTIK',
      'ANDY A SEMBIRING,.S.STP,.M.Si',
      'Pembina Utama Tkt I',
      '19831221 200212 1 004'
    )
) as approvers(
  approver_role,
  scope_label,
  official_name,
  official_title,
  official_nip
)
where rt.template_code = 'bpbd-trc-harian-2026'
on conflict (template_id, approver_role) do update
set scope_label = excluded.scope_label,
    official_name = excluded.official_name,
    official_title = excluded.official_title,
    official_nip = excluded.official_nip,
    is_active = excluded.is_active,
    updated_at = now();

with default_template as (
  select rt.id
  from public.report_templates rt
  where rt.template_code = 'bpbd-trc-harian-2026'
  limit 1
)
update public.daily_reports dr
set template_id = default_template.id
from default_template
where dr.template_id is null;

with template_approvers as (
  select
    rta.id,
    rta.template_id,
    rta.approver_role
  from public.report_template_approvers rta
)
update public.daily_reports dr
set template_approver_coordinator_id = ta.id
from template_approvers ta
where ta.template_id = dr.template_id
  and ta.approver_role = 'coordinator_team'
  and dr.template_approver_coordinator_id is null;

with template_approvers as (
  select
    rta.id,
    rta.template_id,
    rta.approver_role
  from public.report_template_approvers rta
)
update public.daily_reports dr
set template_approver_division_head_id = ta.id
from template_approvers ta
where ta.template_id = dr.template_id
  and ta.approver_role = 'division_head'
  and dr.template_approver_division_head_id is null;
