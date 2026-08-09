import { RULE_KEYS, type RuleKey, isDayComplete, isEntryEmpty, pointsForDay, MONEY_SAVED_PER_DAY } from './challengeConfig'

export interface DailyEntry extends Record<RuleKey, boolean> {
  entry_date: string // 'YYYY-MM-DD'
  notes?: string | null
  water_litres?: number
}

export interface StreakStats {
  currentStreak: number
  longestStreak: number
  totalCompletedDays: number
  totalDaysLogged: number
  completionPct: number // 0-100, over days logged since the first entry
  totalPoints: number
  moneySaved: number
}

function toDateOnly(dateStr: string): Date {
  // Treat as a plain calendar date, no timezone drift.
  const [y, m, d] = dateStr.split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d))
}

function daysBetween(a: Date, b: Date): number {
  const MS_PER_DAY = 24 * 60 * 60 * 1000
  return Math.round((b.getTime() - a.getTime()) / MS_PER_DAY)
}

function todayUTC(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

/**
 * Computes streaks, points, and stats from a user's daily_entries rows.
 * `entries` does not need to be sorted or contiguous - missing dates count as incomplete days.
 */
export function computeStreakStats(entries: DailyEntry[]): StreakStats {
  const sorted = entries
    .filter((e) => !isEntryEmpty(e))
    .sort((a, b) => a.entry_date.localeCompare(b.entry_date))

  let longestStreak = 0
  let runningStreak = 0
  let totalCompletedDays = 0
  let totalPoints = 0
  let moneySaved = 0
  let prevDate: Date | null = null
  let lastCompletedDate: Date | null = null

  for (const entry of sorted) {
    const date = toDateOnly(entry.entry_date)
    const complete = isDayComplete(entry)

    if (entry.no_eating_out) {
      moneySaved += MONEY_SAVED_PER_DAY
    }

    if (complete) {
      const isConsecutive = prevDate !== null && daysBetween(prevDate, date) === 1
      runningStreak = isConsecutive ? runningStreak + 1 : 1
      totalCompletedDays += 1
      totalPoints += pointsForDay(runningStreak)
      longestStreak = Math.max(longestStreak, runningStreak)
      lastCompletedDate = date
    } else {
      runningStreak = 0
    }

    prevDate = date
  }

  // The current streak only counts if the most recent completed day is today or yesterday -
  // otherwise a missed day (or days) has already broken it.
  let currentStreak = 0
  if (lastCompletedDate) {
    const gapToToday = daysBetween(lastCompletedDate, todayUTC())
    if (gapToToday <= 1) {
      currentStreak = runningStreak
    }
  }

  const totalDaysLogged = sorted.length
  const completionPct = totalDaysLogged === 0 ? 0 : Math.round((totalCompletedDays / totalDaysLogged) * 100)

  return {
    currentStreak,
    longestStreak,
    totalCompletedDays,
    totalDaysLogged,
    completionPct,
    totalPoints,
    moneySaved,
  }
}

export { RULE_KEYS }
