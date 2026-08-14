import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import {
  RULES,
  type RuleKey,
  isDayComplete,
  pointsForDay,
  MONEY_CURRENCY_LABEL,
  MAX_BACKFILL_DAYS,
  WATER_TARGET_LITRES,
} from '../lib/challengeConfig'
import { computeStreakStats, type DailyEntry } from '../lib/streaks'
import { todayLocalISO, formatDisplayDate, shiftDateISO, isWeekend } from '../lib/date'
import {
  getPushPermissionState,
  hasActivePushSubscription,
  subscribeToPush,
  type PushPermissionState,
} from '../lib/push'

type RuleState = Record<RuleKey, boolean>
type NonSpecialRuleKey = Exclude<RuleKey, 'water' | 'no_eating_out'>

const emptyRuleState: RuleState = {
  workout: false,
  water: false,
  no_alcohol: false,
  no_eating_out: false,
  reading: false,
}

const waterRule = RULES.find((r) => r.key === 'water')!

export default function TodayPage() {
  const { profile } = useAuth()
  const todayIso = useMemo(() => todayLocalISO(), [])

  const [dayOffset, setDayOffset] = useState(0)
  const selectedDate = useMemo(() => shiftDateISO(todayIso, dayOffset), [todayIso, dayOffset])
  const isToday = dayOffset === 0
  const canGoPrev = dayOffset > -MAX_BACKFILL_DAYS
  const canGoNext = dayOffset < 0
  const weekendExempt = isWeekend(selectedDate)

  const [rules, setRules] = useState<RuleState>(emptyRuleState)
  const [waterLitres, setWaterLitres] = useState(0)
  const [fastFoodOnly, setFastFoodOnly] = useState(false)
  const [allEntries, setAllEntries] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [pushState, setPushState] = useState<PushPermissionState>('unsupported')
  const [pushSubscribed, setPushSubscribed] = useState<boolean | null>(null)
  const [pushError, setPushError] = useState<string | null>(null)
  const [subscribing, setSubscribing] = useState(false)

  useEffect(() => {
    setPushState(getPushPermissionState())
    hasActivePushSubscription().then(setPushSubscribed)
  }, [])

  async function handleEnableNotifications() {
    if (!profile) return
    setSubscribing(true)
    setPushError(null)
    try {
      await subscribeToPush(profile.id)
      setPushSubscribed(true)
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Could not enable notifications')
    }
    setPushState(getPushPermissionState())
    setSubscribing(false)
  }

  const showNotifyBanner = pushSubscribed === false && pushState !== 'denied' && pushState !== 'unsupported'

  // Fetch the user's full history once - date navigation below is then instant/local.
  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, workout, water, water_litres, no_alcohol, no_eating_out, fast_food_only, reading')
        .eq('user_id', profile!.id)
        .order('entry_date', { ascending: true })

      if (cancelled) return
      if (error) setError(error.message)
      else setAllEntries((data ?? []) as DailyEntry[])
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile])

  // Populate the editable form whenever the selected day (or the underlying data) changes.
  useEffect(() => {
    const entry = allEntries.find((e) => e.entry_date === selectedDate)
    if (entry) {
      setRules({
        workout: entry.workout,
        water: entry.water,
        no_alcohol: entry.no_alcohol,
        no_eating_out: entry.no_eating_out,
        reading: entry.reading,
      })
      setWaterLitres(entry.water_litres ?? (entry.water ? WATER_TARGET_LITRES : 0))
      setFastFoodOnly(entry.fast_food_only ?? false)
    } else {
      setRules(emptyRuleState)
      setWaterLitres(0)
      setFastFoodOnly(false)
    }
  }, [selectedDate, allEntries])

  const stats = useMemo(() => {
    const withoutSelected = allEntries.filter((e) => e.entry_date !== selectedDate)
    return computeStreakStats([
      ...withoutSelected,
      { entry_date: selectedDate, water_litres: waterLitres, fast_food_only: fastFoodOnly, ...rules },
    ])
  }, [allEntries, selectedDate, rules, waterLitres, fastFoodOnly])

  const dayComplete = isDayComplete(rules, selectedDate)
  const projectedPoints = dayComplete ? pointsForDay(stats.currentStreak) : 0

  async function persist(nextRules: RuleState, nextWaterLitres: number, nextFastFoodOnly: boolean) {
    if (!profile) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('daily_entries').upsert(
      {
        user_id: profile.id,
        entry_date: selectedDate,
        ...nextRules,
        water_litres: nextWaterLitres,
        fast_food_only: nextFastFoodOnly,
      },
      { onConflict: 'user_id,entry_date' },
    )
    if (error) {
      setError(error.message)
    } else {
      setAllEntries((prev) => {
        const rest = prev.filter((e) => e.entry_date !== selectedDate)
        return [
          ...rest,
          {
            entry_date: selectedDate,
            water_litres: nextWaterLitres,
            fast_food_only: nextFastFoodOnly,
            ...nextRules,
          },
        ]
      })
    }
    setSaving(false)
  }

  function toggleRule(key: NonSpecialRuleKey) {
    const next = { ...rules, [key]: !rules[key] }
    setRules(next)
    persist(next, waterLitres, fastFoodOnly)
  }

  function cycleWater() {
    const next = (waterLitres + 1) % (WATER_TARGET_LITRES + 1)
    const nextRules = { ...rules, water: next >= WATER_TARGET_LITRES }
    setWaterLitres(next)
    setRules(nextRules)
    persist(nextRules, next, fastFoodOnly)
  }

  function selectEatingOut(option: 'no_eating_out' | 'fast_food') {
    const isNoEatingOutActive = rules.no_eating_out && !fastFoodOnly
    const isFastFoodActive = rules.no_eating_out && fastFoodOnly

    let nextNoEatingOut: boolean
    let nextFastFoodOnly: boolean
    if (option === 'no_eating_out') {
      nextNoEatingOut = !isNoEatingOutActive
      nextFastFoodOnly = false
    } else {
      nextNoEatingOut = !isFastFoodActive
      nextFastFoodOnly = nextNoEatingOut
    }

    const nextRules = { ...rules, no_eating_out: nextNoEatingOut }
    setRules(nextRules)
    setFastFoodOnly(nextFastFoodOnly)
    persist(nextRules, waterLitres, nextFastFoodOnly)
  }

  if (loading) return <div className="centered-message">Loading…</div>

  return (
    <div className="today-page">
      <header className="today-header">
        <div className="day-nav">
          <button
            type="button"
            className="day-nav-arrow"
            aria-label="Previous day"
            onClick={() => setDayOffset((o) => Math.max(o - 1, -MAX_BACKFILL_DAYS))}
            disabled={!canGoPrev}
          >
            ‹
          </button>
          <h1>{isToday ? 'Today' : formatDisplayDate(selectedDate)}</h1>
          <button
            type="button"
            className="day-nav-arrow"
            aria-label="Next day"
            onClick={() => setDayOffset((o) => Math.min(o + 1, 0))}
            disabled={!canGoNext}
          >
            ›
          </button>
        </div>
        {isToday ? (
          <p className="today-greeting">
            {formatDisplayDate(selectedDate)} · Hey {profile?.name} 👋
          </p>
        ) : (
          <p className="today-greeting">Backfilling a missed day</p>
        )}
      </header>

      {showNotifyBanner && (
        <div className="notify-banner">
          <span>Get notified when the others finish a workout or complete their day.</span>
          <button type="button" onClick={handleEnableNotifications} disabled={subscribing}>
            {subscribing ? 'Enabling…' : '🔔 Enable notifications'}
          </button>
        </div>
      )}
      {pushError && <p className="form-error">{pushError}</p>}

      <div className={dayComplete ? 'today-status complete' : 'today-status'}>
        {dayComplete ? `All done! +${projectedPoints} pts` : 'Not done yet'}
      </div>

      <ul className="checklist">
        {RULES.map((rule) => {
          if (rule.key === 'water') {
            return (
              <li key="water">
                <button
                  type="button"
                  className={
                    waterLitres >= WATER_TARGET_LITRES
                      ? 'checklist-item checked'
                      : waterLitres > 0
                        ? 'checklist-item partial'
                        : 'checklist-item'
                  }
                  onClick={cycleWater}
                >
                  <span className="checklist-emoji">{waterRule.emoji}</span>
                  <span className="checklist-label">{waterRule.label}</span>
                  <span className="checklist-water-count">
                    {waterLitres}/{WATER_TARGET_LITRES}
                  </span>
                </button>
              </li>
            )
          }

          if (rule.key === 'no_eating_out') {
            const noEatingOutActive = rules.no_eating_out && !fastFoodOnly
            const fastFoodActive = rules.no_eating_out && fastFoodOnly
            return (
              <li key="no_eating_out">
                <div className="eating-out-row">
                  <div className="eating-out-header">
                    <span className="checklist-emoji">{rule.emoji}</span>
                    <span className="checklist-label">Eating out</span>
                    {weekendExempt && <span className="optional-badge">Optional today</span>}
                  </div>
                  <div className="eating-out-options">
                    <button
                      type="button"
                      className={noEatingOutActive ? 'eating-out-pill checked' : 'eating-out-pill'}
                      onClick={() => selectEatingOut('no_eating_out')}
                    >
                      No eating out 💰
                    </button>
                    <button
                      type="button"
                      className={fastFoodActive ? 'eating-out-pill partial' : 'eating-out-pill'}
                      onClick={() => selectEatingOut('fast_food')}
                    >
                      No fast food
                    </button>
                  </div>
                </div>
              </li>
            )
          }

          const key = rule.key as NonSpecialRuleKey
          return (
            <li key={rule.key}>
              <button
                type="button"
                className={rules[key] ? 'checklist-item checked' : 'checklist-item'}
                onClick={() => toggleRule(key)}
              >
                <span className="checklist-emoji">{rule.emoji}</span>
                <span className="checklist-label">{rule.label}</span>
                <span className="checklist-check">{rules[key] ? '✓' : ''}</span>
              </button>
            </li>
          )
        })}
      </ul>

      {saving && <p className="saving-indicator">Saving…</p>}
      {error && <p className="form-error">{error}</p>}

      <div className="stat-row">
        <div className="stat-card">
          <span className="stat-value">{stats.currentStreak}</span>
          <span className="stat-label">Current streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.longestStreak}</span>
          <span className="stat-label">Longest streak</span>
        </div>
        <div className="stat-card">
          <span className="stat-value">{stats.moneySaved} {MONEY_CURRENCY_LABEL}</span>
          <span className="stat-label">Money saved</span>
        </div>
      </div>
    </div>
  )
}
