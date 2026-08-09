import { supabase } from './supabaseClient'

/**
 * There's no real email involved - "passcode" auth is built on top of Supabase's
 * normal email/password auth, using a deterministic fake address per display name
 * (e.g. "Matt" -> matt@30daysoft.local). This keeps auth.uid() / RLS working normally
 * without needing to send real emails. Disable "Confirm email" in the Supabase Auth
 * settings so signUp() logs the user in immediately (see README).
 */

export function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}

export function nameToFakeEmail(name: string): string {
  const slug = slugify(name)
  return `${slug}@30daysoft.local`
}

export async function signUpWithPasscode(name: string, passcode: string) {
  const email = nameToFakeEmail(name)
  const { data, error } = await supabase.auth.signUp({ email, password: passcode })
  if (error) throw error
  if (!data.user) throw new Error('Sign up did not return a user - check Supabase Auth email confirmation setting.')

  const { error: profileError } = await supabase
    .from('profiles')
    .insert({ id: data.user.id, name: name.trim() })
  if (profileError) throw profileError

  return data.user
}

export async function signInWithPasscode(name: string, passcode: string) {
  const email = nameToFakeEmail(name)
  const { data, error } = await supabase.auth.signInWithPassword({ email, password: passcode })
  if (error) throw error
  return data.user
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
