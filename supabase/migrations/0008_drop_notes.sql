-- The notes field added friction with no real use - dropped from both the UI and DB.

alter table public.daily_entries
  drop column if exists notes;
