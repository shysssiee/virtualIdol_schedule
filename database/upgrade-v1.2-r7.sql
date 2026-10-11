begin;
alter table public.event_reports add column if not exists title text not null default '行程修正建議';
alter table public.event_reports add column if not exists reply text not null default '';
create or replace function public.collaborator_directory() returns table(nickname text,role text,online boolean) language sql security definer set search_path=public as $$
 select p.display_name,p.role,exists(select 1 from user_presence u where u.user_id=p.id and u.last_seen>now()-interval '95 seconds') from profiles p where public.is_editor() and p.active and not p.revoked order by p.role desc,p.display_name;
$$;
create or replace function public.board_list() returns table(id uuid,event_id uuid,title text,content text,reply text,resolved boolean,created_at timestamptz,nickname text,mine boolean) language sql security definer set search_path=public as $$
 select r.id,r.event_id,r.title,r.content,r.reply,r.resolved,r.created_at,p.display_name,r.reporter_id=auth.uid() from event_reports r join profiles p on p.id=r.reporter_id where public.is_editor() order by r.created_at desc;
$$;
create or replace function public.board_write(post_id uuid,post_title text,post_content text,linked_event uuid default null) returns uuid language plpgsql security definer set search_path=public as $$
declare result uuid;
begin
 if not public.is_editor() then raise exception 'Not authorized';end if;
 if length(btrim(post_title)) not between 1 and 160 or length(btrim(post_content)) not between 1 and 3000 then raise exception '請填寫標題與內容';end if;
 if post_id is null then insert into event_reports(title,content,event_id,reporter_id) values(btrim(post_title),btrim(post_content),linked_event,auth.uid()) returning id into result;
 else update event_reports set title=btrim(post_title),content=btrim(post_content) where id=post_id and (public.is_owner() or reporter_id=auth.uid()) returning id into result;
 if result is null then raise exception 'Not authorized';end if;end if;
 return result;
end;$$;
create or replace function public.board_answer(post_id uuid,answer text,done boolean) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_owner() then raise exception 'Not authorized';end if;
 if length(answer)>5000 then raise exception '回答最多5000字';end if;
 update event_reports set reply=answer,resolved=done where id=post_id;
end;$$;
create or replace function public.board_delete(post_id uuid) returns void language plpgsql security definer set search_path=public as $$
begin if not public.is_owner() then raise exception 'Not authorized';end if;delete from event_reports where id=post_id;end;$$;
-- Protect direct REST writes, including reply/status and immutable authorship.
create or replace function public.validate_report() returns trigger language plpgsql set search_path=public as $$
begin
 if TG_OP='UPDATE' and (new.reporter_id is distinct from old.reporter_id or new.created_at is distinct from old.created_at) then raise exception 'Cannot change ownership';end if;
 if TG_OP='INSERT' and not public.is_owner() and (new.resolved or new.reply<>'') then raise exception 'Owner only';end if;
 if TG_OP='UPDATE' and not public.is_owner() then
 if new.reply is distinct from old.reply or new.resolved is distinct from old.resolved then raise exception 'Owner only';end if;
 if new.event_id is distinct from old.event_id and not(new.event_id is null and old.event_id is not null and not exists(select 1 from events where id=old.event_id)) then raise exception 'Cannot change linked event';end if;
 end if;return new;
end;$$;
drop trigger if exists report_validation on public.event_reports;
create trigger report_validation before insert or update on public.event_reports for each row execute function public.validate_report();
revoke all on function public.collaborator_directory(),public.board_list(),public.board_write(uuid,text,text,uuid),public.board_answer(uuid,text,boolean),public.board_delete(uuid) from public,anon;
grant execute on function public.collaborator_directory(),public.board_list(),public.board_write(uuid,text,text,uuid),public.board_answer(uuid,text,boolean),public.board_delete(uuid) to authenticated;
commit;
