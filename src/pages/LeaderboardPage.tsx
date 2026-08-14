import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { computeStreakStats, type DailyEntry, type StreakStats } from '../lib/streaks'
import { MONEY_CURRENCY_LABEL } from '../lib/challengeConfig'
import type { Profile } from '../types'

interface LeaderboardRow {
  profile: Profile
  stats: StreakStats
}

export default function LeaderboardPage() {
  const [rows, setRows] = useState<LeaderboardRow[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      const [profilesRes, entriesRes] = await Promise.all([
        supabase.from('profiles').select('id, name, created_at'),
        supabase
          .from('daily_entries')
          .select('user_id, entry_date, workout, water, water_litres, no_alcohol, no_eating_out, fast_food_only, reading'),
      ])

      if (cancelled) return

      if (profilesRes.error) {
        setError(profilesRes.error.message)
        setLoading(false)
        return
      }
      if (entriesRes.error) {
        setError(entriesRes.error.message)
        setLoading(false)
        return
      }

      const profiles = (profilesRes.data ?? []) as Profile[]
      const entries = (entriesRes.data ?? []) as (DailyEntry & { user_id: string })[]

      const computed = profiles
        .map((profile) => {
          const userEntries = entries.filter((e) => e.user_id === profile.id)
          return { profile, stats: computeStreakStats(userEntries) }
        })
        .sort((a, b) => b.stats.currentStreak - a.stats.currentStreak || b.stats.totalPoints - a.stats.totalPoints)

      setRows(computed)
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [])

  if (loading) return <div className="centered-message">Loading…</div>
  if (error) return <div className="centered-message form-error">{error}</div>

  return (
    <div className="leaderboard-page">
      <h1>Leaderboard</h1>

      <ul className="leaderboard-list">
        {rows.map(({ profile, stats }, index) => (
          <li key={profile.id} className="leaderboard-card">
            <div className="leaderboard-rank">#{index + 1}</div>
            <div className="leaderboard-info">
              <div className="leaderboard-name">{profile.name}</div>
              <div className="leaderboard-substats">
                {stats.completionPct}% complete · {stats.totalDaysLogged} days logged
              </div>
            </div>
            <div className="leaderboard-streaks">
              <div className="leaderboard-streak">
                🔥 {stats.currentStreak}
                <span className="leaderboard-streak-label">current</span>
              </div>
              <div className="leaderboard-streak">
                🏅 {stats.longestStreak}
                <span className="leaderboard-streak-label">longest</span>
              </div>
            </div>
            <div className="leaderboard-extra">
              <span>{stats.totalPoints} pts</span>
              <span>{stats.moneySaved} {MONEY_CURRENCY_LABEL} saved</span>
            </div>
          </li>
        ))}
        {rows.length === 0 && <p>No one has joined yet.</p>}
      </ul>
    </div>
  )
}
