-- Fixes a security advisory: set_updated_at had a mutable search_path.
-- Applied live via MCP on 2026-08-09; this file documents it for the repo history.

create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql
set search_path = public;
