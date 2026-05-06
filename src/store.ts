import { create } from 'zustand'
import type {
  Unit, Phase, GameMode, Difficulty, TurnAct,
  PreviewState, GridPos, ForgedEntry, SavedSquad,
} from '@data/types'
import { save } from '@systems/SaveManager'

// ============================================================
// GLOBAL GAME STORE (Zustand)
// Single source of truth for all in-game and meta state.
// React UI reads from here. Battle logic writes here.
// Phaser scene reads visibleCells / fogReveal via refs.
// ============================================================

export type Screen =
  | 'title' | 'build' | 'shop' | 'collection'
  | 'forge'  | 'refine' | 'campaign' | 'inter'
  | 'battle' | 'result'

export interface GameStore {
  // ── Navigation ────────────────────────────────────────────
  screen: Screen
  setScreen: (s: Screen) => void

  // ── Build ────────────────────────────────────────────────
  buildSlots:    (Unit | null)[]
  activeSlot:    number | null
  selPowerId:    string | null
  powerFilter:   string
  setBuildSlot:  (idx: number, unit: Unit | null) => void
  setActiveSlot: (idx: number | null) => void
  setSelPowerId: (id: string | null) => void
  setPowerFilter:(cat: string) => void

  // ── Meta / progression ───────────────────────────────────
  coins:        number
  diamonds:     number
  forged:       ForgedEntry[]
  savedSquads:  SavedSquad[]
  difficulty:   Difficulty
  hintsDismissed: boolean
  addCoins:     (n: number) => void
  spendCoins:   (n: number) => boolean
  spendDiamonds:(n: number) => boolean
  addForged:    (entry: ForgedEntry) => void
  updateForged: (entries: ForgedEntry[]) => void
  setDifficulty:(d: Difficulty) => void
  dismissHints: () => void
  saveSquad:    (name: string) => void
  deleteSquad:  (idx: number) => void
  loadSquad:    (idx: number, applyRefinementsFn: (entry: ForgedEntry, slots: (Unit|null)[]) => (Unit|null)[]) => void

  // ── Battle ───────────────────────────────────────────────
  mode:          GameMode
  units:         Unit[]
  grid:          (string | null)[][]
  walls:         Set<string>
  covers:        Set<string>
  turnOrder:     string[]
  turnIdx:       number
  round:         number
  phase:         Phase
  act:           TurnAct
  preview:       PreviewState | null
  undoPos:       GridPos | null
  visibleCells:  Set<string>
  fogReveal:     Map<string, number>
  turnStartHP:   Record<string, number>
  log:           Array<{ msg: string; type: string; id: number }>
  setMode:       (m: GameMode) => void
  setBattle:     (b: Partial<Pick<GameStore,
    'units'|'grid'|'walls'|'covers'|'turnOrder'|'turnIdx'|'round'
    |'visibleCells'|'fogReveal'>>) => void
  setPhase:      (p: Phase) => void
  setAct:        (a: TurnAct) => void
  setPreview:    (p: PreviewState | null) => void
  setUndoPos:    (pos: GridPos | null) => void
  setUnits:      (units: Unit[]) => void
  setGrid:       (grid: (string | null)[][]) => void
  setVisible:    (v: Set<string>) => void
  setFogReveal:  (m: Map<string, number>) => void
  markTurnStartHP:(unitId: string, hp: number) => void

  // ── Campaign ─────────────────────────────────────────────
  campWave:   number
  campUnits:  Unit[] | null
  campBuff:   string | null
  setCampWave:  (n: number) => void
  setCampUnits: (u: Unit[] | null) => void
  setCampBuff:  (id: string | null) => void

  // ── Result ───────────────────────────────────────────────
  savedSquad: (Unit | null)[] | null
  setSavedSquad: (s: (Unit|null)[] | null) => void

  // ── Forge flow ───────────────────────────────────────────
  forgePendingPowerId: string | null
  setForgePendingPower:(id: string | null) => void

  // ── Refine flow ──────────────────────────────────────────
  refinePendingPowerId: string | null
  setRefinePendingPower:(id: string | null) => void
}

export const useStore = create<GameStore>((set, get) => ({
  // ── Navigation ────────────────────────────────────────────
  screen: 'title',
  setScreen: (s) => set({ screen: s }),

  // ── Build ────────────────────────────────────────────────
  buildSlots:    Array(5).fill(null),
  activeSlot:    null,
  selPowerId:    null,
  powerFilter:   'all',
  setBuildSlot:  (idx, unit) => set(st => {
    const slots = [...st.buildSlots]; slots[idx] = unit; return { buildSlots: slots }
  }),
  setActiveSlot: (idx)  => set({ activeSlot: idx, selPowerId: null }),
  setSelPowerId: (id)   => set({ selPowerId: id }),
  setPowerFilter:(cat)  => set({ powerFilter: cat }),

  // ── Meta ─────────────────────────────────────────────────
  coins:          save.coins,
  diamonds:       save.diamonds,
  forged:         save.forged,
  savedSquads:    save.squads,
  difficulty:     save.difficulty,
  hintsDismissed: save.hintsDismissed,

  addCoins: (n) => {
    save.coins += n; save.persistCoins()
    set({ coins: save.coins, diamonds: save.diamonds })
  },
  spendCoins: (n) => {
    if (save.coins < n) return false
    save.coins -= n; save.persistCoins()
    set({ coins: save.coins }); return true
  },
  spendDiamonds: (n) => {
    if (save.diamonds < n) return false
    save.diamonds -= n; save.persistCoins()
    set({ diamonds: save.diamonds }); return true
  },
  addForged: (entry) => {
    save.forged.push(entry); save.persistForged()
    set({ forged: [...save.forged] })
  },
  updateForged: (entries) => {
    save.forged = entries; save.persistForged()
    set({ forged: [...save.forged] })
  },
  setDifficulty: (d) => {
    save.difficulty = d; save.persistDiff()
    set({ difficulty: d })
  },
  dismissHints: () => {
    save.hintsDismissed = true; save.persistHints()
    set({ hintsDismissed: true })
  },
  saveSquad: (name) => {
    save.squads.push({ name, slots: get().buildSlots })
    save.persistSquads()
    set({ savedSquads: [...save.squads] })
  },
  deleteSquad: (idx) => {
    save.squads.splice(idx, 1); save.persistSquads()
    set({ savedSquads: [...save.squads] })
  },
  loadSquad: (idx, applyRefinementsFn) => {
    const sq = save.squads[idx]
    if (!sq) return
    const slots = applyRefinementsFn(save.forged[0], sq.slots as (Unit|null)[]) // placeholder — real impl in component
    set({ buildSlots: sq.slots as (Unit|null)[] })
  },

  // ── Battle ───────────────────────────────────────────────
  mode:          'quick',
  units:         [],
  grid:          [],
  walls:         new Set(),
  covers:        new Set(),
  turnOrder:     [],
  turnIdx:       0,
  round:         1,
  phase:         'idle',
  act:           { moved: false, punched: false, abilitied: false, doubleUsed: false },
  preview:       null,
  undoPos:       null,
  visibleCells:  new Set(),
  fogReveal:     new Map(),
  turnStartHP:   {},
  log:           [],

  setMode:       (m)    => set({ mode: m }),
  setBattle:     (b)    => set(b),
  setPhase:      (p)    => set({ phase: p }),
  setAct:        (a)    => set({ act: a }),
  setPreview:    (p)    => set({ preview: p }),
  setUndoPos:    (pos)  => set({ undoPos: pos }),
  setUnits:      (u)    => set({ units: u }),
  setGrid:       (g)    => set({ grid: g }),
  setVisible:    (v)    => set({ visibleCells: v }),
  setFogReveal:  (m)    => set({ fogReveal: m }),
  markTurnStartHP: (id, hp) => set(st => ({ turnStartHP: { ...st.turnStartHP, [id]: hp } })),

  // ── Campaign ─────────────────────────────────────────────
  campWave:    0,
  campUnits:   null,
  campBuff:    null,
  setCampWave:  (n) => set({ campWave: n }),
  setCampUnits: (u) => set({ campUnits: u }),
  setCampBuff:  (id) => set({ campBuff: id }),

  // ── Result ───────────────────────────────────────────────
  savedSquad: null,
  setSavedSquad: (s) => set({ savedSquad: s }),

  // ── Forge ────────────────────────────────────────────────
  forgePendingPowerId: null,
  setForgePendingPower: (id) => set({ forgePendingPowerId: id }),

  // ── Refine ───────────────────────────────────────────────
  refinePendingPowerId: null,
  setRefinePendingPower: (id) => set({ refinePendingPowerId: id }),
}))