-- Adds public announcement content to the existing owner-managed settings row.
-- Existing settings_read/settings_owner RLS policies and grants are unchanged.
begin;
alter table public.site_settings
 add column if not exists popup_announcements jsonb not null default '[]'::jsonb;
alter table public.site_settings drop constraint if exists popup_announcements_shape;
alter table public.site_settings add constraint popup_announcements_shape check (
 case when jsonb_typeof(popup_announcements) = 'array'
 then jsonb_array_length(popup_announcements) <= 50 and length(popup_announcements::text) <= 200000
 else false end
);
commit;
