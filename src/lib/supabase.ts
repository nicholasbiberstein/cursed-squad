import { createClient } from '@supabase/supabase-js'

// ============================================================
// SUPABASE CLIENT
// Reads from .env — never hardcode keys here.
// ============================================================

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  as string
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY as string

if (!SUPABASE_URL || !SUPABASE_ANON) {
  console.error('[Supabase] Missing env vars. Check your .env file.')
}

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON)

// ── Types matching our database schema ───────────────────────
export interface DbPlayer {
  id:         string
  username:   string
  created_at: string
  last_login: string
}

export interface DbSave {
  id:            string
  player_id:     string
  coins:         number
  diamonds:      number
  forged:        any[]
  squads:        any[]
  difficulty:    string
  tutorial_done: boolean
  updated_at:    string
}