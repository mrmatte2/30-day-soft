# 30 Day Soft

A mobile-friendly PWA to track a personal "30 Day Soft" challenge for 3 people. Installable to the
home screen on iOS Safari and Android Chrome, no app store involved. Data lives in a single
Supabase Postgres project (one row per user per day), deployed as a static site to GitHub Pages.

## Stack

- **Frontend:** React + Vite (TypeScript)
- **Data:** Supabase (Postgres + Auth, free tier)
- **PWA:** `vite-plugin-pwa` (manifest + service worker)
- **Hosting:** GitHub Pages, auto-deployed via GitHub Actions on push to `main`

## 1. Create the Supabase project

1. Create a new project at [supabase.com](https://supabase.com) (or reuse your existing free-tier one).
2. In the SQL Editor, run [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql). This creates
   `profiles` and `daily_entries` with row-level security so everyone can read all rows (for the
   leaderboard) but only write their own.
3. Go to **Authentication → Providers → Email** and turn **off "Confirm email"**. This app uses a
   lightweight passcode login built on top of Supabase's normal email/password auth (see below) -
   with email confirmation off, `signUp()` logs the user in immediately with no real email involved.
4. Go to **Project Settings → API** and copy the **Project URL** and **anon public key**.

### How passcode login works

There's no real email. Each person's display name (e.g. "Matt") is turned into a fake, deterministic
address like `matt@30daysoft.local`, and their chosen passcode is used as the password via Supabase's
normal `signUp` / `signInWithPassword`. This keeps `auth.uid()` and RLS working exactly like a normal
Supabase Auth setup, without needing to send real emails to 3 people. See
[`src/lib/auth.ts`](src/lib/auth.ts).

The first time each of the 3 of you opens the app, use "Create one" on the login screen to register a
name + passcode (Supabase requires passcodes to be 6+ characters). After that, log in normally.

## 2. Configure environment variables

```bash
cp .env.example .env.local
```

Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from step 1.4.

## 3. Run locally

```bash
npm install
npm run dev
```

## 4. Tune the rules and scoring

Everything about the daily rules, streak multiplier, and "money saved" amount lives in one file:
[`src/lib/challengeConfig.ts`](src/lib/challengeConfig.ts).

- `RULES` — the list of daily checklist items (currently placeholders: workout, water, no_alcohol,
  no_eating_out). Renaming/adding/removing a rule here also requires updating the matching column(s)
  in a new Supabase migration (add `alter table public.daily_entries add column ...` etc.) since each
  rule is a boolean column.
- `getStreakMultiplier(streakLength)` — how many points a completed day is worth as your streak grows
  (defaults: 1x for streak < 5, 2x for 5-9, 3x for 10+). Edit the `thresholds` array to tune.
- `MONEY_SAVED_PER_DAY` / `MONEY_CURRENCY_LABEL` — amount and currency label added to the running
  "money saved" stat for each day `no_eating_out` is checked (defaults to 150 kr).

Streak/points math itself (consecutive-day logic, longest streak, completion %) lives in
[`src/lib/streaks.ts`](src/lib/streaks.ts) and shouldn't need to change when you tune the numbers above.

## 5. Deploy to GitHub Pages

1. Push this repo to GitHub. If your repo name isn't `30-day-soft`, update `REPO_NAME` in
   [`vite.config.ts`](vite.config.ts) to match (GitHub Pages serves project sites from
   `https://<user>.github.io/<repo>/`, so the Vite `base` has to match the repo name).
2. In the repo's **Settings → Pages**, set **Source** to **GitHub Actions**.
3. In **Settings → Secrets and variables → Actions**, add two repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Push to `main`. The [`deploy.yml`](.github/workflows/deploy.yml) workflow builds and publishes to
   Pages automatically.

## 6. Install on your phones

- **Android (Chrome):** open the deployed URL, tap the menu (⋮) → "Add to Home screen" / "Install app".
- **iOS (Safari):** open the deployed URL, tap the Share icon → "Add to Home Screen". (Must be Safari -
  Chrome on iOS can't install PWAs.)

## Data model

- `profiles` — `id` (= Supabase Auth user id), `name`, `created_at`
- `daily_entries` — `id`, `user_id`, `entry_date`, one boolean column per rule, `notes`, timestamps.
  Unique on `(user_id, entry_date)`. A day only counts as "complete" if every rule column is `true`
  (see `isDayComplete` in `challengeConfig.ts`).

RLS: any authenticated user can `select` all rows in both tables (needed for the shared
leaderboard); `insert`/`update`/`delete` on `daily_entries` and `profiles` is restricted to rows where
`user_id`/`id` matches `auth.uid()`.
