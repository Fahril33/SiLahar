alter table public.daily_report_audit_logs
alter column report_id drop not null;

alter table public.daily_report_audit_logs
drop constraint if exists daily_report_audit_logs_report_id_fkey;

alter table public.daily_report_audit_logs
add constraint daily_report_audit_logs_report_id_fkey
foreign key (report_id)
references public.daily_reports(id)
on delete set null;

create or replace function public.log_daily_report_changes()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.daily_report_audit_logs (
      report_id,
      action_type,
      actor_role,
      actor_label,
      actor_admin_id,
      snapshot
    )
    values (
      new.id,
      'create',
      new.created_by_role,
      new.created_by_label,
      new.created_by_admin_id,
      public.report_payload(new.id)
    );
    return new;
  elsif tg_op = 'UPDATE' then
    insert into public.daily_report_audit_logs (
      report_id,
      action_type,
      actor_role,
      actor_label,
      actor_admin_id,
      snapshot
    )
    values (
      new.id,
      'update',
      new.updated_by_role,
      new.updated_by_label,
      new.updated_by_admin_id,
      jsonb_build_object(
        'old_report', to_jsonb(old),
        'new_payload', public.report_payload(new.id)
      )
    );
    return new;
  elsif tg_op = 'DELETE' then
    insert into public.daily_report_audit_logs (
      report_id,
      action_type,
      actor_role,
      actor_label,
      actor_admin_id,
      snapshot
    )
    values (
      null,
      'delete',
      old.updated_by_role,
      old.updated_by_label,
      old.updated_by_admin_id,
      jsonb_build_object(
        'deleted_report_id', old.id,
        'deleted_report', to_jsonb(old)
      )
    );
    return old;
  end if;

  return null;
end;
$$;
