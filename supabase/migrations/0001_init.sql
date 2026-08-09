-- 30 Day Soft: initial schema
-- Run this in the Supabase SQL editor (or via `supabase db push` if you use the CLI).

-- ---------------------------------------------------------------------------
-- profiles
-- ---------------------------------------------------------------------------
-- One row per person, keyed by their Supabase Auth user id.
-- Created client-side right after auth.signUp() (see src/lib/auth.ts).

create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Everyone (any of the 3 signed-in users) can read all profiles, for the leaderboard.
create policy "profiles are readable by any authenticated user"
  on public.profiles for select
  to authenticated
  using (true);

-- You can only create/update your own profile row.
create policy "users can insert their own profile"
  on public.profiles for insert
  to authenticated
  with check (id = auth.uid());

create policy "users can update their own profile"
  on public.profiles for update
  to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- ---------------------------------------------------------------------------
-- daily_entries
-- ---------------------------------------------------------------------------
-- One row per user per day. Rule columns are placeholders - rename/add/remove
-- them to match the final rule set, and keep src/lib/challengeConfig.ts (RULES)
-- in sync when you do.

create table if not exists public.daily_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  entry_date date not null,
  workout boolean not null default false,
  water boolean not null default false,
  no_alcohol boolean not null default false,
  no_eating_out boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, entry_date)
);

create index if not exists daily_entries_user_date_idx
  on public.daily_entries (user_id, entry_date);

alter table public.daily_entries enable row level security;

-- Everyone can read everyone's entries, for the shared leaderboard/stats view.
create policy "daily_entries are readable by any authenticated user"
  on public.daily_entries for select
  to authenticated
  using (true);

-- You can only write your own entries.
create policy "users can insert their own daily_entries"
  on public.daily_entries for insert
  to authenticated
  with check (user_id = auth.uid());

create policy "users can update their own daily_entries"
  on public.daily_entries for update
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create policy "users can delete their own daily_entries"
  on public.daily_entries for delete
  to authenticated
  using (user_id = auth.uid());

-- Keep updated_at current on every update.
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists set_daily_entries_updated_at on public.daily_entries;
create trigger set_daily_entries_updated_at
  before update on public.daily_entries
  for each row
  execute function public.set_updated_at();
