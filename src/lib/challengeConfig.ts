/**
 * Single source of truth for the "30 Day Soft" rules and scoring.
 * Tune these values as the three of you finalize the real rules and point values.
 *
 * If you rename/add/remove a rule key here, also update the matching column(s)
 * in supabase/migrations/0001_init.sql (and run a follow-up migration on the DB).
 */

export interface RuleDef {
  key: RuleKey
  label: string
  emoji: string
}

export const RULES = [
  { key: 'workout', label: 'Workout (30 minutes)', emoji: '💪' },
  { key: 'water', label: 'Water (3 litres)', emoji: '💧' },
  { key: 'no_alcohol', label: 'No alcohol (unless social)', emoji: '🚫🍷' },
  { key: 'no_eating_out', label: 'No eating out', emoji: '🍳' },
] as const satisfies readonly RuleDef[]

export type RuleKey = 'workout' | 'water' | 'no_alcohol' | 'no_eating_out'

export const RULE_KEYS = RULES.map((r) => r.key) as RuleKey[]

/** A day only "counts" if every rule below is checked true. */
export function isDayComplete(entry: Record<RuleKey, boolean>): boolean {
  return RULE_KEYS.every((key) => entry[key] === true)
}

// --- Points / streak multiplier -------------------------------------------

/** Base points awarded for a single completed day, before the streak multiplier. */
export const BASE_POINTS_PER_DAY = 10

/**
 * Streak multiplier as a function of the *current streak length including today*.
 * Thresholds are checked from highest to lowest.
 * e.g. streak 1-4 -> 1x, 5-9 -> 2x, 10+ -> 3x.
 */
export function getStreakMultiplier(streakLength: number): number {
  const thresholds: Array<{ minStreak: number; multiplier: number }> = [
    { minStreak: 10, multiplier: 3 },
    { minStreak: 5, multiplier: 2 },
    { minStreak: 0, multiplier: 1 },
  ]
  const match = thresholds.find((t) => streakLength >= t.minStreak)
  return match ? match.multiplier : 1
}

/** Points earned for a completed day, given the streak length as of that day (including it). */
export function pointsForDay(streakLength: number): number {
  return BASE_POINTS_PER_DAY * getStreakMultiplier(streakLength)
}

// --- "Money saved" stat -----------------------------------------------------

/** Kronor "saved" for each day no_eating_out is checked true. */
export const MONEY_SAVED_PER_DAY = 150

/** Currency suffix shown after the amount, e.g. "150 kr". */
export const MONEY_CURRENCY_LABEL = 'kr'
