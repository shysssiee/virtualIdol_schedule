begin;
create or replace function public.event_creator_names() returns table(event_id uuid,nickname text)
language sql security definer set search_path=public as $$
 select e.id,p.display_name from events e left join profiles p on p.id=e.created_by where public.is_editor();
$$;
revoke all on function public.event_creator_names() from public,anon;
grant execute on function public.event_creator_names() to authenticated;
commit;
