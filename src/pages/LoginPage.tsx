import { useState, type FormEvent } from 'react'
import { signInWithPasscode, signUpWithPasscode } from '../lib/auth'
import { useAuth } from '../context/AuthContext'

export default function LoginPage() {
  const { refreshProfile } = useAuth()
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [name, setName] = useState('')
  const [passcode, setPasscode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e: FormEvent) {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (mode === 'login') {
        await signInWithPasscode(name, passcode)
      } else {
        await signUpWithPasscode(name, passcode)
        // The profiles insert (inside signUpWithPasscode) finishes after the auth
        // listener's own profile fetch already fired, so force a fresh one now.
        await refreshProfile()
      }
      // AuthContext's onAuthStateChange listener picks up the new session and redirects.
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="login-page">
      <h1>30 Day Soft</h1>
      <p className="login-subtitle">
        {mode === 'login' ? 'Enter your name and passcode.' : 'First time? Pick a name and passcode.'}
      </p>

      <form onSubmit={handleSubmit} className="login-form">
        <label>
          Name
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Passcode
          <input
            type="password"
            value={passcode}
            onChange={(e) => setPasscode(e.target.value)}
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
            required
          />
        </label>

        {error && <p className="form-error">{error}</p>}

        <button type="submit" disabled={submitting}>
          {submitting ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'}
        </button>
      </form>

      <button
        type="button"
        className="link-button"
        onClick={() => {
          setMode(mode === 'login' ? 'signup' : 'login')
          setError(null)
        }}
      >
        {mode === 'login' ? "Don't have an account yet? Create one" : 'Already have an account? Log in'}
      </button>
    </div>
  )
}
