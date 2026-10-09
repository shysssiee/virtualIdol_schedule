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
 if TG_OP='UPDATE' then
   if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
     raise exception 'Event ownership and creation time cannot be changed';
   end if;
 end if;
 select * into g from public.groups where id=new.group_id;
 if not (new.category_id=any(g.category_ids)) then raise exception '所選活動分類未開放給此團體'; end if;
 if exists(select 1 from unnest(new.member_ids) as chosen(id) where not exists(select 1 from members m where m.id=chosen.id and m.group_id=new.group_id)) then
   raise exception 'Members must belong to selected group';
 end if;
 for item in select * from jsonb_array_elements(new.links) loop
   if item->>'url' is null or item->>'url' !~ '^https?://' or not exists(select 1 from platforms where id::text=item->>'platform_id' and id=any(g.platform_ids)) then
     raise exception '平台未開放給此團體，或直播連結格式不正確';
   end if;
 end loop;
 new.updated_at=now();return new;
end;
$$;
create function public.validate_group_options() returns trigger language plpgsql set search_path=public as $$
begin
 if exists(select 1 from unnest(new.category_ids) as x(id) where not exists(select 1 from categories where id=x.id))
 or exists(select 1 from unnest(new.platform_ids) as x(id) where not exists(select 1 from platforms where id=x.id)) then
 raise exception '分類或平台不存在'; end if;
 if TG_OP='UPDATE' then
 if exists(select 1 from events where group_id=new.id and not(category_id=any(new.category_ids)))
 or exists(select 1 from events e cross join lateral jsonb_array_elements(e.links) as l where e.group_id=new.id and not((l->>'platform_id')::uuid=any(new.platform_ids))) then
 raise exception '此分類或平台已有行程使用，請先修改相關行程'; end if;
 end if;
 return new;
end;
$$;
create trigger group_options before insert or update on public.groups for each row execute function public.validate_group_options();
create function public.protect_catalog_delete() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_TABLE_NAME='categories' then
 if exists(select 1 from groups where old.id=any(category_ids)) or exists(select 1 from events where category_id=old.id) then raise exception '活動分類已被團體或行程使用，請先解除使用'; end if;
 elsif TG_TABLE_NAME='platforms' then
 if exists(select 1 from groups where old.id=any(platform_ids)) or exists(select 1 from events e cross join lateral jsonb_array_elements(e.links) as l where l->>'platform_id'=old.id::text) then raise exception '平台已被團體或行程使用，請先解除使用'; end if;
 elsif TG_TABLE_NAME='members' then
 if exists(select 1 from events where old.id=any(member_ids)) then raise exception '成員已有行程使用，無法刪除'; end if;
 end if;
 return old;
end;
$$;
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

