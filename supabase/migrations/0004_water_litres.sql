-- Makes water tracking dynamic: 0-3 litres, complete once it hits the target.
-- `water` (boolean) stays the authoritative "complete" flag used by streak/leaderboard
-- logic - the app keeps it in sync with water_litres on every write.

alter table public.daily_entries
  add column if not exists water_litres smallint not null default 0;

-- Backfill existing rows so old fully-checked days still read as 3/3.
update public.daily_entries
  set water_litres = 3
  where water = true and water_litres = 0;

alter table public.daily_entries
  add constraint daily_entries_water_litres_range check (water_litres >= 0 and water_litres <= 3);
