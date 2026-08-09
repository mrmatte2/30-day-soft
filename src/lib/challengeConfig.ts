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
  { key: 'reading', label: 'Read 10-20 pages', emoji: '📖' },
] as const satisfies readonly RuleDef[]

export type RuleKey = 'workout' | 'water' | 'no_alcohol' | 'no_eating_out' | 'reading'

export const RULE_KEYS = RULES.map((r) => r.key) as RuleKey[]

/** A day only "counts" if every rule below is checked true. */
export function isDayComplete(entry: Record<RuleKey, boolean>): boolean {
  return RULE_KEYS.every((key) => entry[key] === true)
}

/**
 * True if nothing was actually logged for this day - every rule is unchecked, no partial
 * water, no notes. A row can still exist in the DB in this state (e.g. someone tapped a
 * rule by accident and immediately undid it) - those rows shouldn't count as "logged".
 */
export function isEntryEmpty(
  entry: Record<RuleKey, boolean> & { notes?: string | null; water_litres?: number },
): boolean {
  const hasAnyRuleChecked = RULE_KEYS.some((key) => entry[key] === true)
  const hasPartialWater = (entry.water_litres ?? 0) > 0
  const hasNotes = !!entry.notes && entry.notes.trim() !== ''
  return !hasAnyRuleChecked && !hasPartialWater && !hasNotes
}

/** How many days back you're allowed to backfill a missed entry. No forward logging. */
export const MAX_BACKFILL_DAYS = 5

/** Litres of water needed for the water rule to count as complete. */
export const WATER_TARGET_LITRES = 3

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
