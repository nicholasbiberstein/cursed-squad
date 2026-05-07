import { supabase } from './supabase'
import { save } from '@systems/SaveManager'
import { useStore } from '@store'
import type { ForgedEntry, SavedSquad, Difficulty } from '@data/types'
import { markTutorialComplete } from '@ui/screens/tutorial/TutorialManager'

// ============================================================
// AUTH MANAGER
// Handles sign up, sign in, sign out, and cloud save sync.
// Guest mode: game works fully offline with localStorage.
// Logged in mode: saves sync to Supabase on every battle end.
// ============================================================

export interface AuthUser {
  id:       string
  email:    string
  username: string
}

// ── Current session ──────────────────────────────────────────
let _currentUser: AuthUser | null = null

export function getCurrentUser(): AuthUser | null {
  return _currentUser
}

export function isLoggedIn(): boolean {
  return _currentUser !== null
}

// ── Init — call once on app start ────────────────────────────
export async function initAuth(): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.user) {
    await loadUserProfile(session.user.id, session.user.email ?? '')
  }

  // Listen for auth state changes
  supabase.auth.onAuthStateChange(async (event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      await loadUserProfile(session.user.id, session.user.email ?? '')
    }
    if (event === 'SIGNED_OUT') {
      _currentUser = null
      useStore.setState({ authUser: null })
    }
  })
}

async function loadUserProfile(userId: string, email: string): Promise<void> {
  const { data: player } = await supabase
    .from('players')
    .select('*')
    .eq('id', userId)
    .single()

  _currentUser = {
    id:       userId,
    email,
    username: player?.username ?? email.split('@')[0],
  }

  useStore.setState({ authUser: _currentUser })

  // Load cloud save and merge with local
  await pullCloudSave()
}

// ── Sign up ───────────────────────────────────────────────────
export async function signUp(
  email: string,
  password: string,
  username: string
): Promise<{ error: string | null }> {
  const { data, error } = await supabase.auth.signUp({ email, password })

  if (error) return { error: error.message }
  if (!data.user) return { error: 'Sign up failed — please try again.' }

  // Update username
  await supabase
    .from('players')
    .update({ username })
    .eq('id', data.user.id)

  // Push current local save to cloud
  await pushCloudSave()

  return { error: null }
}

// ── Sign in ───────────────────────────────────────────────────
export async function signIn(
  email: string,
  password: string
): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) return { error: error.message }

  // Update last login
  const { data: { user } } = await supabase.auth.getUser()
  if (user) {
    await supabase.from('players').update({ last_login: new Date().toISOString() }).eq('id', user.id)
  }

  return { error: null }
}

// ── Sign out ──────────────────────────────────────────────────
export async function signOut(): Promise<void> {
  await pushCloudSave() // Save before signing out
  await supabase.auth.signOut()
  _currentUser = null
  useStore.setState({ authUser: null })
}

// ── Forgot password ───────────────────────────────────────────
export async function resetPassword(email: string): Promise<{ error: string | null }> {
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${window.location.origin}/reset-password`,
  })
  return { error: error?.message ?? null }
}

// ── Push local save → cloud ───────────────────────────────────
export async function pushCloudSave(): Promise<void> {
  if (!_currentUser) return

  const { error } = await supabase
    .from('saves')
    .upsert({
      player_id:     _currentUser.id,
      coins:         save.coins,
      diamonds:      save.diamonds,
      forged:        save.forged,
      squads:        save.squads,
      difficulty:    save.difficulty,
      tutorial_done: true,
      updated_at:    new Date().toISOString(),
    }, { onConflict: 'player_id' })

  if (error) console.error('[Auth] Failed to push save:', error.message)
}

// ── Pull cloud save → local ───────────────────────────────────
export async function pullCloudSave(): Promise<void> {
  if (!_currentUser) return

  const { data, error } = await supabase
    .from('saves')
    .select('*')
    .eq('player_id', _currentUser.id)
    .single()

  if (error || !data) return

  // Cloud save wins if it has more coins/diamonds (anti-cheat basic check)
  // If local has more progress, keep local
  const useCloud = data.coins >= save.coins && data.diamonds >= save.diamonds

  if (useCloud) {
    save.coins      = data.coins
    save.diamonds   = data.diamonds
    save.forged     = data.forged    as ForgedEntry[]
    save.squads     = data.squads    as any[]
    save.difficulty = data.difficulty as Difficulty
    save.persistAll()

    useStore.setState({
      coins:       save.coins,
      diamonds:    save.diamonds,
      forged:      save.forged,
      savedSquads: save.squads,
      difficulty:  save.difficulty,
    })
  } else {
    // Local is ahead — push it to cloud
    await pushCloudSave()
  }

  if (data.tutorial_done) markTutorialComplete()
}