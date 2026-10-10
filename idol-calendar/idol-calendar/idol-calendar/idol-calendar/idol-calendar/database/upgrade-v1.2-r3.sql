-- v1.2 r3. Apply after v1.2 upgrade; safe to rerun. No existing events are removed.
begin;
create table if not exists public.anniversaries(
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.groups(id),member_id uuid references public.members(id),
 kind text not null check(kind in ('birthday','debut','anniversary')),
 name text not null check(length(trim(name)) between 1 and 160),
 original_date date not null check(original_date >= date '1800-01-01'),
 created_by uuid not null default auth.uid() references auth.users(id),created_at timestamptz not null default now()
);
create table if not exists public.event_reports(
 id uuid primary key default gen_random_uuid(),event_id uuid references public.events(id) on delete set null,
 reporter_id uuid not null default auth.uid() references auth.users(id),
 content text not null check(length(trim(content)) between 1 and 3000),resolved boolean not null default false,
 created_at timestamptz not null default now()
);
create or replace function public.validate_anniversary() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and (new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at) then raise exception 'Cannot change anniversary ownership';end if;
 if new.member_id is not null and not exists(select 1 from members where id=new.member_id and group_id=new.group_id) then raise exception 'Member must belong to group';end if;
 return new;
end;$$;
drop trigger if exists anniversary_validation on public.anniversaries;
create trigger anniversary_validation before insert or update on public.anniversaries for each row execute function public.validate_anniversary();
create or replace function public.validate_report() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and (new.reporter_id is distinct from old.reporter_id or new.created_at is distinct from old.created_at or new.event_id is distinct from old.event_id or new.content is distinct from old.content) then
  if not(new.event_id is null and old.event_id is not null and not exists(select 1 from events where id=old.event_id) and new.reporter_id=old.reporter_id and new.created_at=old.created_at and new.content=old.content) then raise exception 'Report contents cannot change';end if;
 end if;return new;
end;$$;
drop trigger if exists report_validation on public.event_reports;
create trigger report_validation before update on public.event_reports for each row execute function public.validate_report();
alter table public.anniversaries enable row level security;
alter table public.event_reports enable row level security;
drop policy if exists anniversary_read on public.anniversaries;
create policy anniversary_read on public.anniversaries for select to anon,authenticated using(true);
drop policy if exists anniversary_insert on public.anniversaries;
create policy anniversary_insert on public.anniversaries for insert to authenticated with check(public.is_editor() and created_by=auth.uid());
drop policy if exists anniversary_edit on public.anniversaries;
create policy anniversary_edit on public.anniversaries for update to authenticated using(public.is_owner() or (public.is_editor() and created_by=auth.uid())) with check(public.is_owner() or (public.is_editor() and created_by=auth.uid()));
drop policy if exists anniversary_delete on public.anniversaries;
create policy anniversary_delete on public.anniversaries for delete to authenticated using(public.is_owner() or (public.is_editor() and created_by=auth.uid()));
drop policy if exists report_read on public.event_reports;
create policy report_read on public.event_reports for select to authenticated using(public.is_owner() or (public.is_editor() and reporter_id=auth.uid()));
drop policy if exists report_insert on public.event_reports;
create policy report_insert on public.event_reports for insert to authenticated with check(public.is_editor() and reporter_id=auth.uid() and not resolved and exists(select 1 from events where id=event_id));
drop policy if exists report_resolve on public.event_reports;
create policy report_resolve on public.event_reports for update to authenticated using(public.is_owner()) with check(public.is_owner());
grant select on public.anniversaries to anon;
grant select,insert,update,delete on public.anniversaries to authenticated;
grant select,insert,update on public.event_reports to authenticated;
commit;
