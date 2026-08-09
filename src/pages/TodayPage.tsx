import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { useAuth } from '../context/AuthContext'
import { RULES, type RuleKey, isDayComplete, pointsForDay } from '../lib/challengeConfig'
import { computeStreakStats, type DailyEntry } from '../lib/streaks'
import { todayLocalISO, formatDisplayDate } from '../lib/date'

type RuleState = Record<RuleKey, boolean>

const emptyRuleState: RuleState = {
  workout: false,
  water: false,
  no_alcohol: false,
  no_eating_out: false,
}

export default function TodayPage() {
  const { profile } = useAuth()
  const today = useMemo(() => todayLocalISO(), [])

  const [rules, setRules] = useState<RuleState>(emptyRuleState)
  const [notes, setNotes] = useState('')
  const [allEntries, setAllEntries] = useState<DailyEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!profile) return
    let cancelled = false

    async function load() {
      setLoading(true)
      const { data, error } = await supabase
        .from('daily_entries')
        .select('entry_date, workout, water, no_alcohol, no_eating_out, notes')
        .eq('user_id', profile!.id)
        .order('entry_date', { ascending: true })

      if (cancelled) return
      if (error) {
        setError(error.message)
      } else {
        const entries = (data ?? []) as DailyEntry[]
        setAllEntries(entries)
        const todayEntry = entries.find((e) => e.entry_date === today)
        if (todayEntry) {
          setRules({
            workout: todayEntry.workout,
            water: todayEntry.water,
            no_alcohol: todayEntry.no_alcohol,
            no_eating_out: todayEntry.no_eating_out,
          })
          setNotes(todayEntry.notes ?? '')
        }
      }
      setLoading(false)
    }

    load()
    return () => {
      cancelled = true
    }
  }, [profile, today])

  const stats = useMemo(() => {
    const withoutToday = allEntries.filter((e) => e.entry_date !== today)
    return computeStreakStats([...withoutToday, { entry_date: today, notes, ...rules }])
  }, [allEntries, today, rules, notes])

  const todayComplete = isDayComplete(rules)
  const projectedPoints = todayComplete ? pointsForDay(stats.currentStreak) : 0

  async function persist(nextRules: RuleState, nextNotes: string) {
    if (!profile) return
    setSaving(true)
    setError(null)
    const { error } = await supabase
      .from('daily_entries')
      .upsert(
        { user_id: profile.id, entry_date: today, ...nextRules, notes: nextNotes },
        { onConflict: 'user_id,entry_date' },
      )
    if (error) {
      setError(error.message)
    } else {
      setAllEntries((prev) => {
        const rest = prev.filter((e) => e.entry_date !== today)
        return [...rest, { entry_date: today, notes: nextNotes, ...nextRules }]
      })
    }
    setSaving(false)
  }

  function toggleRule(key: RuleKey) {
    const next = { ...rules, [key]: !rules[key] }
    setRules(next)
    persist(next, notes)
  }

  function handleNotesBlur() {
    persist(rules, notes)
  }

  if (loading) return <div className="centered-message">Loading…</div>

  return (
    <div className="today-page">
      <header className="today-header">
        <h1>{formatDisplayDate(today)}</h1>
        {profile && <p className="today-greeting">Hey {profile.name} 👋</p>}
      </header>

      <div className={todayComplete ? 'today-status complete' : 'today-status'}>
        {todayComplete ? `All done! +${projectedPoints} pts` : 'Not done yet'}
      </div>

      <ul className="checklist">
        {RULES.map((rule) => (
          <li key={rule.key}>
            <button
              type="button"
              className={rules[rule.key] ? 'checklist-item checked' : 'checklist-item'}
              onClick={() => toggleRule(rule.key)}
            >
              <span className="checklist-emoji">{rule.emoji}</span>
              <span className="checklist-label">{rule.label}</span>
              <span className="checklist-check">{rules[rule.key] ? '✓' : ''}</span>
            </button>
          </li>
        ))}
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
          <span className="stat-value">${stats.moneySaved}</span>
          <span className="stat-label">Money saved</span>
        </div>
      </div>
    </div>
  )
}
