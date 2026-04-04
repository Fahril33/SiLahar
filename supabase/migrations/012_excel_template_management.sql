do $$
begin
  if to_regclass('public.excel_templates') is not null then
    drop trigger if exists trg_excel_templates_enforce_primary on public.excel_templates;
    drop trigger if exists trg_excel_templates_updated_at on public.excel_templates;
    drop policy if exists "public read excel_templates" on public.excel_templates;
    drop policy if exists "admin manage excel_templates" on public.excel_templates;
  end if;
end;
$$;

drop function if exists public.enforce_single_primary_excel_template();

create table if not exists public.excel_report_templates (
  id uuid primary key default gen_random_uuid(),
  template_name text not null,
  cache_version text not null,
  storage_path text not null unique,
  public_url text not null,
  is_active boolean not null default false,
  uploaded_by_admin_id uuid references public.admin_profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into storage.buckets (id, name, public)
values ('report-excel-templates', 'report-excel-templates', true)
on conflict (id) do update
set public = true;


create unique index if not exists uq_excel_report_templates_single_active
on public.excel_report_templates (is_active)
where is_active = true;

drop trigger if exists trg_excel_report_templates_updated_at on public.excel_report_templates;
create trigger trg_excel_report_templates_updated_at
before update on public.excel_report_templates
for each row
execute function public.set_updated_at();

alter table public.excel_report_templates enable row level security;

drop policy if exists "public read active excel_report_templates" on public.excel_report_templates;
create policy "public read active excel_report_templates"
on public.excel_report_templates
for select
to anon, authenticated
using (is_active = true or public.is_admin());

drop policy if exists "admin manage excel_report_templates" on public.excel_report_templates;
create policy "admin manage excel_report_templates"
on public.excel_report_templates
for all
to authenticated
using (public.is_admin())
with check (public.is_admin());

create or replace function public.set_active_excel_report_template(
  template_id_input uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_admin() then
    raise exception 'Akses admin diperlukan.';
  end if;

  if template_id_input is null then
    raise exception 'Template Excel belum valid.';
  end if;

  if not exists (
    select 1
    from public.excel_report_templates
    where id = template_id_input
  ) then
    raise exception 'Template Excel tidak ditemukan.';
  end if;

  update public.excel_report_templates
  set is_active = false,
      updated_at = now()
  where is_active = true;

  update public.excel_report_templates
  set is_active = true,
      updated_at = now()
  where id = template_id_input;
end;
$$;

grant execute on function public.set_active_excel_report_template(uuid) to authenticated;

drop policy if exists "public read report excel templates" on storage.objects;
create policy "public read report excel templates"
on storage.objects
for select
to anon, authenticated
using (bucket_id = 'report-excel-templates');

drop policy if exists "admin upload report excel templates" on storage.objects;
create policy "admin upload report excel templates"
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'report-excel-templates'
  and public.is_admin()
);

drop policy if exists "admin update report excel templates" on storage.objects;
create policy "admin update report excel templates"
on storage.objects
for update
to authenticated
using (
  bucket_id = 'report-excel-templates'
  and public.is_admin()
)
with check (
  bucket_id = 'report-excel-templates'
  and public.is_admin()
);

drop policy if exists "admin delete report excel templates" on storage.objects;
create policy "admin delete report excel templates"
on storage.objects
for delete
to authenticated
using (
  bucket_id = 'report-excel-templates'
  and public.is_admin()
);

drop table if exists public.excel_templates;
