-- Existing v1.1 only. Back up first. Safe to rerun.
-- Apply to an existing v1.1 database. Version remains v1.1. Safe to reapply.
begin;
alter table public.events alter column category_id drop not null;
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
commit;

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
