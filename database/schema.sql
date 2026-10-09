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
 category_id uuid references public.categories(id),
 member_ids uuid[] not null default '{}',
 start_at timestamptz not null,end_at timestamptz,
 status text not null default 'scheduled' check(status in ('scheduled','ended','cancelled')),
 description text not null default '' check(length(description)<=5000),
 links jsonb not null check(jsonb_typeof(links)='array' and jsonb_array_length(links) between 0 and 20),
 created_by uuid not null default auth.uid() references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 check(end_at is null or (end_at>start_at and end_at<=start_at+interval '4 hours'))
);
create index events_start_at on public.events(start_at);
create index events_group_id on public.events(group_id);
create index events_created_by on public.events(created_by);
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

-- v1.1 configuration, ordering and validation
-- Existing v1.0 databases: execute once BEFORE uploading v1.1 website files.
-- No events or users are deleted. Existing groups initially retain all categories/platforms.
begin;
alter table public.groups add column if not exists category_ids uuid[] not null default '{}';
alter table public.groups add column if not exists platform_ids uuid[] not null default '{}';
do $$ declare t text; begin
 foreach t in array array['groups','members','categories','platforms'] loop
 execute format('alter table public.%I add column if not exists sort_order integer not null default 0',t);
 end loop;
end $$;
update public.groups set category_ids=array(select id from public.categories order by name,id),platform_ids=array(select id from public.platforms order by name,id);
do $$ declare c record; begin
 for c in select conname from pg_constraint where conrelid='public.events'::regclass and contype='c'
 and (pg_get_constraintdef(oid) like '%end_at%' or pg_get_constraintdef(oid) like '%links%') loop
 execute format('alter table public.events drop constraint %I',c.conname);
 end loop;
end $$;
alter table public.events add constraint events_duration_check check(end_at is null or (end_at>start_at and end_at<=start_at+interval '4 hours'));
alter table public.events add constraint events_links_check check(jsonb_typeof(links)='array' and jsonb_array_length(links) between 0 and 20);
create table public.site_settings(singleton boolean primary key default true check(singleton),name text not null check(length(trim(name)) between 1 and 80));
insert into public.site_settings values(true,'星曆');
alter table public.site_settings enable row level security;
create policy settings_read on public.site_settings for select to anon,authenticated using(true);
create policy settings_owner on public.site_settings for update to authenticated using(public.is_owner()) with check(public.is_owner());
grant select on public.site_settings to anon,authenticated;
grant update on public.site_settings to authenticated;

create or replace function public.validate_event() returns trigger language plpgsql set search_path=public as $$
declare item jsonb;g public.groups;
begin
 if TG_OP='UPDATE' and (new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at) then
 raise exception 'Event ownership and creation time cannot be changed'; end if;
 select * into g from groups where id=new.group_id;
 if new.category_id is not null and not(new.category_id=any(g.category_ids)) then raise exception '所選活動分類未開放給此團體'; end if;
 if exists(select 1 from unnest(new.member_ids) as chosen(id) where not exists(select 1 from members m where m.id=chosen.id and m.group_id=new.group_id)) then raise exception 'Members must belong to selected group'; end if;
 for item in select * from jsonb_array_elements(new.links) loop
 if item->>'url' is null or item->>'url' !~ '^https?://' or not exists(select 1 from platforms where id::text=item->>'platform_id' and id=any(g.platform_ids)) then raise exception '平台未開放給此團體，或直播連結格式不正確'; end if;
 end loop;
 new.updated_at=now();return new;
end;$$;
create or replace function public.validate_group_options() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from unnest(new.category_ids) as x(id) where not exists(select 1 from categories where id=x.id))
 or exists(select 1 from unnest(new.platform_ids) as x(id) where not exists(select 1 from platforms where id=x.id)) then raise exception '分類或平台不存在'; end if;
 if TG_OP='UPDATE' then
 if exists(select 1 from events where group_id=new.id and category_id is not null and not(category_id=any(new.category_ids)))
 or exists(select 1 from events e cross join lateral jsonb_array_elements(e.links) as l where e.group_id=new.id and not((l->>'platform_id')::uuid=any(new.platform_ids))) then raise exception '此分類或平台已有行程使用，請先修改相關行程'; end if;
 end if;
 return new;
end;$$;
create trigger group_options before insert or update on public.groups for each row execute function public.validate_group_options();
create or replace function public.protect_catalog_delete() returns trigger language plpgsql security definer set search_path=public as $$
declare used_titles text;
begin
 if TG_TABLE_NAME='categories' then
 select string_agg(title,'、') into used_titles from (select title from events where category_id=old.id order by start_at limit 10) as used;
 if used_titles is not null then raise exception '活動分類仍被行程使用：%。請先修改這些行程。',used_titles; end if;
 update groups set category_ids=array_remove(category_ids,old.id) where old.id=any(category_ids);
 elsif TG_TABLE_NAME='platforms' then
 select string_agg(title,'、') into used_titles from (select distinct e.title from events e cross join lateral jsonb_array_elements(e.links) as l where l->>'platform_id'=old.id::text limit 10) as used;
 if used_titles is not null then raise exception '平台仍被行程使用：%。請先修改這些行程。',used_titles; end if;
 update groups set platform_ids=array_remove(platform_ids,old.id) where old.id=any(platform_ids);
 elsif TG_TABLE_NAME='members' then
 if exists(select 1 from events where old.id=any(member_ids)) then raise exception '成員已有行程使用，無法刪除'; end if;
 end if;
 return old;
end;$$;
do $$ declare t text; begin
 foreach t in array array['members','categories','platforms'] loop
 execute format('create trigger protect_delete before delete on public.%I for each row execute function public.protect_catalog_delete()',t);
 end loop;
end $$;
create function public.reorder_catalog(catalog text,ids uuid[]) returns void language plpgsql security definer set search_path=public as $$
declare i integer;
begin
 if not public.is_owner() then raise exception '僅站主可排序'; end if;
 if catalog not in ('groups','members','categories','platforms') then raise exception 'Invalid catalog'; end if;
 if cardinality(ids)<> (select count(distinct id) from unnest(ids) as x(id)) then raise exception 'Duplicate ids'; end if;
 for i in 1..coalesce(cardinality(ids),0) loop
 execute format('update public.%I set sort_order=$1 where id=$2',catalog) using i,ids[i];
 end loop;
end;
$$;
revoke all on function public.reorder_catalog(text,uuid[]) from public;
grant execute on function public.reorder_catalog(text,uuid[]) to authenticated;
commit;


create trigger validate_event before insert or update on public.events for each row execute function public.validate_event();

-- v1.2: retain absolute event times and author records.
begin;
alter table public.events add column if not exists input_timezone text not null default 'Asia/Taipei';
alter table public.events drop constraint if exists events_input_timezone_check;
alter table public.events add constraint events_input_timezone_check check(input_timezone in ('Asia/Taipei','Asia/Seoul'));
alter table public.profiles add column if not exists revoked boolean not null default false;
alter table public.site_settings add column if not exists report_url text not null default '';
alter table public.site_settings add column if not exists default_timezone text not null default 'auto';
alter table public.site_settings drop constraint if exists settings_report_check;
alter table public.site_settings add constraint settings_report_check check(report_url='' or report_url ~ '^https://(forms\.gle|docs\.google\.com)/');
alter table public.site_settings drop constraint if exists settings_timezone_check;
alter table public.site_settings add constraint settings_timezone_check check(default_timezone in ('auto','Asia/Taipei','Asia/Seoul','Asia/Tokyo','America/New_York','America/Los_Angeles','Europe/London','UTC'));
create or replace function public.is_owner() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and role='owner' and active and not revoked);
$$;
create or replace function public.is_editor() returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from profiles where id=auth.uid() and active and not revoked);
$$;
create or replace function public.revoke_collaborator(user_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_owner() then raise exception '僅站主可移除協作者'; end if;
 if exists(select 1 from profiles where id=user_id and role='owner') then raise exception '不能移除站主'; end if;
 update profiles set active=false,revoked=true where id=user_id and role='collaborator';
 if not found then raise exception '找不到協作者'; end if;
end;
$$;
revoke all on function public.revoke_collaborator(uuid) from public,anon;
grant execute on function public.revoke_collaborator(uuid) to authenticated;
commit;
