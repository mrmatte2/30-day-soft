-- Adds the "Read 10-20 pages" rule as a new boolean column.
-- Keep this in sync with RULES in src/lib/challengeConfig.ts.

alter table public.daily_entries
  add column if not exists reading boolean not null default false;
