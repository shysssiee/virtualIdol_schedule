-- Replace the email with your manually created Auth user's email, then run.
insert into public.profiles (id,display_name,role,active)
select id,'站主','owner',true from auth.users where email='REPLACE_WITH_YOUR_EMAIL'
on conflict(id) do update set role='owner',active=true;
