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
import { todayLocalISO, formatDisplayDate, shiftDateISO } from '../lib/date'

type RuleState = Record<RuleKey, boolean>

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

  const [rules, setRules] = useState<RuleState>(emptyRuleState)
  const [waterLitres, setWaterLitres] = useState(0)
  const [notes, setNotes] = useState('')
  const [allEntries, setAllEntries] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Fetch the user's full history once - date navigation below is then instant/local.
  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, workout, water, water_litres, no_alcohol, no_eating_out, reading, notes')
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
      setNotes(entry.notes ?? '')
    } else {
      setRules(emptyRuleState)
      setWaterLitres(0)
      setNotes('')
    }
  }, [selectedDate, allEntries])

  const stats = useMemo(() => {
    const withoutSelected = allEntries.filter((e) => e.entry_date !== selectedDate)
    return computeStreakStats([
      ...withoutSelected,
      { entry_date: selectedDate, notes, water_litres: waterLitres, ...rules },
    ])
  }, [allEntries, selectedDate, rules, waterLitres, notes])

  const dayComplete = isDayComplete(rules)
  const projectedPoints = dayComplete ? pointsForDay(stats.currentStreak) : 0

  async function persist(nextRules: RuleState, nextWaterLitres: number, nextNotes: string) {
    if (!profile) return
    setSaving(true)
    setError(null)
    const { error } = await supabase.from('daily_entries').upsert(
      {
        user_id: profile.id,
        entry_date: selectedDate,
        ...nextRules,
        water_litres: nextWaterLitres,
        notes: nextNotes,
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
          { entry_date: selectedDate, notes: nextNotes, water_litres: nextWaterLitres, ...nextRules },
        ]
      })
    }
    setSaving(false)
  }

  function toggleRule(key: Exclude<RuleKey, 'water'>) {
    const next = { ...rules, [key]: !rules[key] }
    setRules(next)
    persist(next, waterLitres, notes)
  }

  function cycleWater() {
    const next = (waterLitres + 1) % (WATER_TARGET_LITRES + 1)
    const nextRules = { ...rules, water: next >= WATER_TARGET_LITRES }
    setWaterLitres(next)
    setRules(nextRules)
    persist(nextRules, next, notes)
  }

  function handleNotesBlur() {
    persist(rules, waterLitres, notes)
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

      <div className={dayComplete ? 'today-status complete' : 'today-status'}>
        {dayComplete ? `All done! +${projectedPoints} pts` : 'Not done yet'}
      </div>

      <ul className="checklist">
        {RULES.map((rule) =>
          rule.key === 'water' ? (
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
          ) : (
            <li key={rule.key}>
              <button
                type="button"
                className={rules[rule.key] ? 'checklist-item checked' : 'checklist-item'}
                onClick={() => toggleRule(rule.key as Exclude<RuleKey, 'water'>)}
              >
                <span className="checklist-emoji">{rule.emoji}</span>
                <span className="checklist-label">{rule.label}</span>
                <span className="checklist-check">{rules[rule.key] ? '✓' : ''}</span>
              </button>
            </li>
          ),
        )}
      </ul>

      <label className="notes-field">
        Notes
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          onBlur={handleNotesBlur}
          rows={3}
          placeholder="Optional"
        />
      </label>

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
