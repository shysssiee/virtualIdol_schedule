-- Run once in a new Supabase project's SQL Editor.
begin;
create table public.profiles (
 id uuid primary key references auth.users(id) on delete cascade,
 display_name text not null check(length(display_name) between 1 and 80),
 role text not null default 'collaborator' check(role in ('owner','collaborator')),
 active boolean not null default true
);
create function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role='owner' and active);
$$;
create function public.is_editor() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and active);
$$;
create table public.groups(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 1 and 80),color text not null check(color ~ '^#[0-9a-fA-F]{6}$'));
create table public.members(id uuid primary key default gen_random_uuid(),group_id uuid not null references public.groups(id),name text not null check(length(name) between 1 and 80),unique(group_id,name));
create table public.categories(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 1 and 80));
create table public.platforms(id uuid primary key default gen_random_uuid(),name text not null unique check(length(name) between 1 and 80));
create table public.events(
 id uuid primary key default gen_random_uuid(),
 title text not null check(length(trim(title)) between 1 and 160),
 group_id uuid not null references public.groups(id),
 category_id uuid not null references public.categories(id),
 member_ids uuid[] not null default '{}',
 start_at timestamptz not null,end_at timestamptz,
 status text not null default 'scheduled' check(status in ('scheduled','ended','cancelled')),
 description text not null default '' check(length(description)<=5000),
 links jsonb not null check(jsonb_typeof(links)='array' and jsonb_array_length(links) between 1 and 20),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_at is null or (end_at>start_at and end_at<=start_at+interval '2 hours'))
);
create index events_start_at on public.events(start_at);
create index events_group_id on public.events(group_id);
create index events_created_by on public.events(created_by);
create function public.validate_event() returns trigger language plpgsql set search_path=public as $$
declare item jsonb;
begin
 if TG_OP='UPDATE' then
   if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
     raise exception 'Event ownership and creation time cannot be changed';
   end if;
 end if;
 if exists(select 1 from unnest(new.member_ids) as chosen(id) where not exists(select 1 from members m where m.id=chosen.id and m.group_id=new.group_id)) then
   raise exception 'Members must belong to selected group';
 end if;
 for item in select * from jsonb_array_elements(new.links) loop
   if item->>'url' is null or item->>'url' !~ '^https?://' or not exists(select 1 from platforms where id::text=item->>'platform_id') then
     raise exception 'Invalid platform or stream URL';
   end if;
 end loop;
 new.updated_at=now();return new;
end;
$$;
create trigger validate_event before insert or update on public.events for each row execute function public.validate_event();
alter table public.profiles enable row level security;
create policy profiles_read on public.profiles for select to authenticated using(id=auth.uid() or public.is_owner());
create policy profiles_owner_insert on public.profiles for insert to authenticated with check(public.is_owner());
create policy profiles_owner_update on public.profiles for update to authenticated using(public.is_owner()) with check(public.is_owner());
do $$ declare t text; begin
 foreach t in array array['groups','members','categories','platforms'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('create policy catalog_read on public.%I for select to anon, authenticated using(true)',t);
 execute format('create policy catalog_owner on public.%I for all to authenticated using(public.is_owner()) with check(public.is_owner())',t);
 end loop;
end $$;
alter table public.events enable row level security;
create policy events_read on public.events for select to anon, authenticated using(true);
create policy events_insert on public.events for insert to authenticated with check(public.is_editor() and created_by=auth.uid());
create policy events_update on public.events for update to authenticated using(public.is_owner() or (public.is_editor() and created_by=auth.uid())) with check(public.is_owner() or (public.is_editor() and created_by=auth.uid()));
create policy events_delete on public.events for delete to authenticated using(public.is_owner());
grant select on public.groups,public.members,public.categories,public.platforms,public.events to anon;
grant select,insert,update,delete on public.groups,public.members,public.categories,public.platforms,public.events to authenticated;
grant select,insert,update on public.profiles to authenticated;
revoke all on function public.is_owner(),public.is_editor() from public;
grant execute on function public.is_owner(),public.is_editor() to authenticated;
commit;
