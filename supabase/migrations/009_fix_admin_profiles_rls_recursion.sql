create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_profiles ap
    where ap.id = auth.uid()
      and ap.is_active = true
  );
$$;

grant execute on function public.is_admin() to anon, authenticated;

drop policy if exists "admin can read admin_profiles" on public.admin_profiles;
drop policy if exists "authenticated users can read own admin profile" on public.admin_profiles;
drop policy if exists "active admins can read admin_profiles" on public.admin_profiles;

create policy "authenticated users can read own admin profile"
on public.admin_profiles
for select
to authenticated
using (
  id = auth.uid()
  and is_active = true
);

create policy "active admins can read admin_profiles"
on public.admin_profiles
for select
to authenticated
using (public.is_admin());
