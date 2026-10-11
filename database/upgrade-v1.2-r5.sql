begin;
-- Only add or reuse members; collaborators cannot edit/delete catalog entries.
create or replace function public.add_group_member(target_group uuid, member_name text) returns public.members
language plpgsql security definer set search_path=public as $$
declare result public.members; clean_name text:=btrim(member_name);
begin
 if not public.is_editor() then raise exception 'Not authorized'; end if;
 if clean_name is null or length(clean_name) not between 1 and 80 then raise exception '成員名字需為1至80字';end if;
 if not exists(select 1 from public.groups where id=target_group) then raise exception '團體不存在';end if;
 perform pg_advisory_xact_lock(hashtextextended(target_group::text||lower(clean_name),0));
 select * into result from public.members where group_id=target_group and lower(btrim(name))=lower(clean_name) order by sort_order,id limit 1;
 if result.id is null then
 insert into public.members(group_id,name,sort_order) values(target_group,clean_name,(select coalesce(max(sort_order),0)+1 from public.members where group_id=target_group)) returning * into result;
 end if;
 return result;
end;$$;
revoke all on function public.add_group_member(uuid,text) from public,anon;
grant execute on function public.add_group_member(uuid,text) to authenticated;
commit;
