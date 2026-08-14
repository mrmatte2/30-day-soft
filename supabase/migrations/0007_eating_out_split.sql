-- Splits the eating-out rule into two mutually-exclusive options, chosen client-side:
-- "No eating out" (keeps no_eating_out=true, fast_food_only=false) still earns the
-- money-saved bonus. "No fast food" (no_eating_out=true, fast_food_only=true) still
-- counts toward day completion but earns no money - it's about food choices, not
-- spending, and exists so people can eat out with colleagues without breaking the day.
--
-- Existing rows default fast_food_only=false, so historically logged "no eating out"
-- days keep their money-saved credit unchanged.

alter table public.daily_entries
  add column if not exists fast_food_only boolean not null default false;
