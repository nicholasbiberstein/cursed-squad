import type { SaveData, ForgedEntry, SavedSquad, Difficulty } from '@data/types'
import { STARTER_LOADOUT } from '@data/starterLoadout'

// ============================================================
// SAVE MANAGER
// Versioned localStorage wrapper.
// Migrates saves from previous HTML prototype versions.
// ============================================================

const SAVE_VER = 'cs_1.0'

function lsGet<T>(key: string, def: T): T {
  try {
    const v = localStorage.getItem(`${SAVE_VER}_${key}`)
    return v !== null ? (JSON.parse(v) as T) : def
  } catch {
    return def
  }
}

function lsSet(key: string, value: unknown): void {
  try {
    localStorage.setItem(`${SAVE_VER}_${key}`, JSON.stringify(value))
  } catch { /* storage full or unavailable */ }
}

// ── Migration from HTML prototype versions ───────────────────
function migrateLegacySaves(): void {
  if (lsGet('migrated', false)) return
  const prefixes = ['cs_0.65_', 'cs_0.6_', 'cs_0.5_', 'cs_']
  for (const p of prefixes) {
    try {
      const coins    = parseInt(localStorage.getItem(`${p}coins`)    ?? '0', 10)
      const diamonds = parseInt(localStorage.getItem(`${p}diamonds`) ?? '0', 10)
      if (coins > 0 && lsGet('coins', 0) === 0) {
        lsSet('coins',    Math.min(coins,    9_999))
        lsSet('diamonds', Math.min(diamonds, 999))
      }
      // Only migrate non-empty forged arrays
      const raw = localStorage.getItem(`${p}forged`)
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as ForgedEntry[]
          if (Array.isArray(parsed) && parsed.length > 0 && lsGet<ForgedEntry[]>('forged', []).length === 0) {
            lsSet('forged', parsed)
          }
        } catch { /* corrupt save — ignore */ }
      }
      if (coins > 0) break
    } catch { /* old key missing */ }
  }
  lsSet('migrated', true)
}

// ── Starter loadout guard ────────────────────────────────────
function ensureStarters(forged: ForgedEntry[]): ForgedEntry[] {
  const missing = STARTER_LOADOUT.filter(
    s => !forged.find(f => f.powerId === s.powerId)
  )
  if (missing.length === 0) return forged
  return [...missing.map(s => ({ ...s })), ...forged]
}

// ── Public API ───────────────────────────────────────────────
export class SaveManager {
  private static _instance: SaveManager | null = null

  coins:           number
  diamonds:        number
  forged:          ForgedEntry[]
  squads:          SavedSquad[]
  difficulty:      Difficulty
  hintsDismissed:  boolean

  private constructor() {
    migrateLegacySaves()
    this.coins          = lsGet('coins',           320)
    this.diamonds       = lsGet('diamonds',        10)
    this.forged         = ensureStarters(lsGet<ForgedEntry[]>('forged', []))
    this.squads         = lsGet<SavedSquad[]>('squads', [])
    this.difficulty     = lsGet<Difficulty>('difficulty', 'standard')
    this.hintsDismissed = lsGet<boolean>('hints_dismissed', false)
    this.persistForged() // ensure starters are written to storage
  }

  static getInstance(): SaveManager {
    if (!SaveManager._instance) SaveManager._instance = new SaveManager()
    return SaveManager._instance
  }

  // Persist individual fields
  persistCoins():    void { lsSet('coins', this.coins);       lsSet('diamonds', this.diamonds) }
  persistForged():   void { lsSet('forged', this.forged) }
  persistSquads():   void { lsSet('squads', this.squads) }
  persistDiff():     void { lsSet('difficulty', this.difficulty) }
  persistHints():    void { lsSet('hints_dismissed', this.hintsDismissed) }

  // Convenience getters
  getForged(powerId: string): ForgedEntry | undefined {
    return this.forged.find(f => f.powerId === powerId)
  }
  hasForged(powerId: string): boolean {
    return !!this.getForged(powerId)
  }

  // Snapshot everything at once (e.g. before app close)
  persistAll(): void {
    this.persistCoins()
    this.persistForged()
    this.persistSquads()
    this.persistDiff()
    this.persistHints()
  }
}

// Singleton accessor — import and use anywhere
export const save = SaveManager.getInstance()
