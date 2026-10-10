begin;
create table if not exists public.visitor_presence(id uuid primary key,last_seen timestamptz not null default now());
alter table public.visitor_presence enable row level security;
revoke all on public.visitor_presence from anon,authenticated;
create or replace function public.visitor_online(visitor_id uuid) returns integer language plpgsql security definer set search_path='' as $$
declare total integer;
begin
 if visitor_id is null then raise exception 'Invalid visitor';end if;
 delete from public.visitor_presence where last_seen < now()-interval '2 minutes';
 insert into public.visitor_presence(id,last_seen) values(visitor_id,now()) on conflict(id) do update set last_seen=excluded.last_seen;
 select count(*) into total from public.visitor_presence where last_seen >= now()-interval '2 minutes';
 return total;
end;$$;
create or replace function public.end_live(event_id uuid) returns void language plpgsql security definer set search_path='' as $$
declare found_event public.events;
begin
 select * into found_event from public.events where id=event_id for update;
 if not found or not (public.is_owner() or (public.is_editor() and found_event.created_by=auth.uid())) then raise exception '無權結束此行程';end if;
 if found_event.status <> 'scheduled' or found_event.start_at > now() or found_event.start_at+interval '2 hours' <= now() then raise exception '此行程目前不在直播提示期間';end if;
 update public.events set status='ended' where id=event_id;
end;$$;
create or replace function public.website_backup() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception '僅站主可下載備份';end if;
 return jsonb_build_object('format','idol-calendar-data','version','v1.3','exported_at',now(),'tables',jsonb_build_object(
 'groups',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.groups t),
 'members',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.members t),
 'categories',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.categories t),
 'platforms',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.platforms t),
 'events',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.events t),
 'anniversaries',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.anniversaries t),
 'profiles',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.profiles t),
 'site_settings',(select coalesce(jsonb_agg(to_jsonb(t)),'[]'::jsonb) from public.site_settings t),
 'event_reports',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.event_reports t),
 'visitor_messages',(select coalesce(jsonb_agg(to_jsonb(t) order by t.id),'[]'::jsonb) from public.visitor_messages t)
 ));
end;$$;
revoke all on function public.visitor_online(uuid),public.end_live(uuid),public.website_backup() from public,anon,authenticated;
grant execute on function public.visitor_online(uuid) to anon,authenticated;
grant execute on function public.end_live(uuid),public.website_backup() to authenticated;
commit;
