-- Fires the notify-on-complete Edge Function whenever today's entry changes,
-- so it can detect "workout just finished" / "day just completed" and push
-- the other two users. Only fires for today's date - backfilled past days
-- (via the 5-day-back arrows) don't trigger a notification.
--
-- Built directly on pg_net rather than the dashboard's "Database Webhooks"
-- feature (which needs a supabase_functions schema that isn't provisioned on
-- this project) - same underlying mechanism either way, just self-contained.
--
-- The Authorization header uses the public anon key (safe to commit - it's
-- the same key already embedded in the client bundle). It's required so the
-- function's verify_jwt check accepts the call; the function itself uses its
-- own service-role key internally to read across users.
--
-- Note: CURRENT_DATE here is evaluated in the database's session timezone
-- (UTC), not the user's local timezone - in the narrow window right around
-- midnight in Sweden this could occasionally treat "today" a few hours off.
-- Not worth over-engineering for a 3-person app.

create extension if not exists pg_net;

create or replace function public.notify_on_complete_trigger()
returns trigger as $$
begin
  perform net.http_post(
    url := 'https://dzwedbnnvuchabkbzppf.supabase.co/functions/v1/notify-on-complete',
    body := jsonb_build_object(
      'type', TG_OP,
      'table', TG_TABLE_NAME,
      'schema', TG_TABLE_SCHEMA,
      'record', to_jsonb(NEW),
      'old_record', case when TG_OP = 'UPDATE' then to_jsonb(OLD) else null end
    ),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR6d2VkYm5udnVjaGFia2J6cHBmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODYyODQ1MjcsImV4cCI6MjEwMTg2MDUyN30.fHUE4bd6WUlDmCoJggr4BTDXH6VjS-IAQNw7GrLhL-k'
    ),
    timeout_milliseconds := 5000
  );
  return NEW;
end;
$$ language plpgsql security definer set search_path = public, extensions, net;

drop trigger if exists notify_on_complete_webhook on public.daily_entries;
create trigger notify_on_complete_webhook
  after insert or update on public.daily_entries
  for each row
  when (NEW.entry_date = CURRENT_DATE)
  execute function public.notify_on_complete_trigger();
