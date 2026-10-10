begin;
create table if not exists public.user_presence(
 user_id uuid not null references auth.users(id) on delete cascade,
 session_id uuid not null,last_seen timestamptz not null default now(),primary key(user_id,session_id)
);
alter table public.user_presence enable row level security;
drop policy if exists presence_read on public.user_presence;
create policy presence_read on public.user_presence for select to authenticated using(public.is_owner() or (public.is_editor() and user_id=auth.uid()));
grant select on public.user_presence to authenticated;
create or replace function public.presence_signal(session_id uuid,is_active boolean) returns void language plpgsql security definer set search_path=public as $$
begin
 if not public.is_editor() then raise exception 'Not authorized';end if;
 if is_active then
 insert into user_presence(user_id,session_id,last_seen) values(auth.uid(),session_id,now()) on conflict on constraint user_presence_pkey do update set last_seen=now();
 else delete from user_presence where user_id=auth.uid() and user_presence.session_id=presence_signal.session_id;
 end if;
 delete from user_presence where last_seen<now()-interval '1 day';
end;$$;
revoke all on function public.presence_signal(uuid,boolean) from public,anon;
grant execute on function public.presence_signal(uuid,boolean) to authenticated;
commit;
