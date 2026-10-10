begin;
alter table public.anniversaries add column if not exists year_unknown boolean not null default false;
do $$begin
 if not exists(select 1 from pg_constraint where conname='anniversary_unknown_year' and conrelid='public.anniversaries'::regclass) then
  alter table public.anniversaries add constraint anniversary_unknown_year check(not year_unknown or (kind='birthday' and extract(year from original_date)=2000));
 end if;
end;$$;
create table if not exists public.visitor_messages (
 id uuid primary key default gen_random_uuid(), kind text not null check(kind in ('application','report')),
 nickname text not null default '訪客', email text, contact text,
 title text not null, content text not null default '', reply text not null default '',
 resolved boolean not null default false, created_at timestamptz not null default now()
);
alter table public.visitor_messages enable row level security;
revoke all on public.visitor_messages from anon,authenticated;
drop policy if exists visitor_message_read on public.visitor_messages;
create policy visitor_message_read on public.visitor_messages for select to authenticated using(public.is_owner() or (public.is_editor() and kind='report'));
create or replace function public.visitor_submit(message_kind text,applicant_name text default '',applicant_email text default '',applicant_contact text default '',report_type text default '',report_content text default '',website text default '')
returns void language plpgsql security definer set search_path='' as $$
declare n text:=btrim(coalesce(applicant_name,''));e text:=lower(btrim(coalesce(applicant_email,'')));c text:=btrim(coalesce(applicant_contact,''));t text:=btrim(coalesce(report_type,''));body text:=btrim(coalesce(report_content,''));fingerprint text;
begin
 if coalesce(website,'')<>'' then raise exception '無法送出';end if;
 if message_kind='application' then
  if char_length(n) not between 1 and 80 or char_length(e) not between 3 and 254 or e !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or char_length(c) not between 1 and 300 then raise exception '請填寫暱稱、有效信箱及聯絡方式';end if;
  t:='協作者申請：'||n;body:='申請加入協作者';
 elsif message_kind='report' then
  if t not in ('網站BUG','行程直播時間錯誤','名稱錯誤','其他') or char_length(body) not between 1 and 100 then raise exception '請選擇問題類型，內容需1至100字';end if;
  n:='訪客';e:=null;c:=null;
 else raise exception '無效的表單類型';end if;
 fingerprint:=message_kind||t||body||coalesce(e,'');
 perform pg_advisory_xact_lock(hashtextextended(fingerprint,0));
 if exists(select 1 from public.visitor_messages v where v.kind=message_kind and v.title=t and v.content=body and coalesce(v.email,'')=coalesce(e,'') and v.created_at>now()-interval '1 minute') then raise exception '相同內容已送出，請勿重複送出';end if;
 insert into public.visitor_messages(kind,nickname,email,contact,title,content) values(message_kind,n,e,c,t,body);
end;$$;
create or replace function public.board_feed() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare result jsonb;
begin
 if not public.is_editor() then raise exception 'Not authorized';end if;
 select coalesce(jsonb_agg(to_jsonb(x) order by x.created_at desc,x.id desc),'[]'::jsonb) into result from (
  select r.id,r.event_id,r.title,r.content,r.reply,r.resolved,r.created_at,p.display_name as nickname,r.reporter_id=auth.uid() as mine,'member'::text as source,'member'::text as kind,null::text as email,null::text as contact
  from public.event_reports r join public.profiles p on p.id=r.reporter_id
  union all
  select v.id,null::uuid,v.title,v.content,v.reply,v.resolved,v.created_at,v.nickname,false,'visitor',v.kind,
   case when public.is_owner() then v.email else null end,case when public.is_owner() then v.contact else null end
  from public.visitor_messages v where v.kind='report' or public.is_owner()
 ) x;
 return result;
end;$$;
create or replace function public.visitor_answer(message_id uuid,answer text,done boolean) returns void language plpgsql security definer set search_path='' as $$
begin
 if not public.is_owner() then raise exception 'Not authorized';end if;
 if answer is null or char_length(answer)>5000 or done is null then raise exception '回答最多5000字';end if;
 update public.visitor_messages set reply=answer,resolved=done where id=message_id;
end;$$;
create or replace function public.visitor_delete(message_id uuid) returns void language plpgsql security definer set search_path='' as $$
begin if not public.is_owner() then raise exception 'Not authorized';end if;delete from public.visitor_messages where id=message_id;end;$$;
revoke all on function public.visitor_submit(text,text,text,text,text,text,text),public.board_feed(),public.visitor_answer(uuid,text,boolean),public.visitor_delete(uuid) from public,anon,authenticated;
grant execute on function public.visitor_submit(text,text,text,text,text,text,text) to anon,authenticated;
grant execute on function public.board_feed(),public.visitor_answer(uuid,text,boolean),public.visitor_delete(uuid) to authenticated;
commit;
