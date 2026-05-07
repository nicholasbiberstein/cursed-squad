import { create } from 'zustand'
import type {
  Unit, Phase, GameMode, Difficulty, TurnAct,
  PreviewState, GridPos, ForgedEntry, SavedSquad,
} from '@data/types'
import { save } from '@systems/SaveManager'

// ============================================================
// GLOBAL GAME STORE (Zustand)
// NEW TURN SYSTEM:
//   - battlePhase: 'player' | 'enemy' | 'idle'
//   - selectedUnitId: which player unit is currently selected
//   - unitActs: per-unit action tracking { [unitId]: { moved, acted } }
//   - Player controls ALL their units before clicking END TURN
//   - Then enemies resolve one by one automatically
// ============================================================

export type Screen =
  | 'title' | 'build' | 'shop' | 'collection'
  | 'forge'  | 'refine' | 'campaign' | 'inter'
  | 'battle' | 'result'

export type BattlePhase = 'player' | 'enemy' | 'idle'

export interface UnitAct {
  moved:  boolean
  acted:  boolean  // ability OR punch — only one per unit per round
}

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
  coins:          number
  diamonds:       number
  forged:         ForgedEntry[]
  savedSquads:    SavedSquad[]
  difficulty:     Difficulty
  hintsDismissed: boolean
  addCoins:       (n: number) => void
  spendCoins:     (n: number) => boolean
  spendDiamonds:  (n: number) => boolean
  addForged:      (entry: ForgedEntry) => void
  updateForged:   (entries: ForgedEntry[]) => void
  setDifficulty:  (d: Difficulty) => void
  dismissHints:   () => void
  saveSquad:      (name: string) => void
  deleteSquad:    (idx: number) => void
  loadSquad:      (idx: number, applyRefinementsFn: (entry: ForgedEntry, slots: (Unit|null)[]) => (Unit|null)[]) => void

  // ── Battle state ─────────────────────────────────────────
  mode:           GameMode
  units:          Unit[]
  grid:           (string | null)[][]
  walls:          Set<string>
  covers:         Set<string>
  round:          number

  // New turn system
  battlePhase:    BattlePhase       // 'player' | 'enemy' | 'idle'
  selectedUnitId: string | null     // which player unit is selected
  unitActs:       Record<string, UnitAct>  // per-unit action budget
  enemyQueue:     string[]          // enemy ids waiting to act this round

  // Action state for the selected unit
  phase:          Phase             // idle | move | punch | ability | preview
  preview:        PreviewState | null
  undoPos:        GridPos | null

  visibleCells:   Set<string>
  fogReveal:      Map<string, number>
  turnStartHP:    Record<string, number>
  log:            Array<{ msg: string; type: string; id: number }>

  setMode:           (m: GameMode) => void
  setBattlePhase:    (p: BattlePhase) => void
  setSelectedUnit:   (id: string | null) => void
  setUnitAct:        (unitId: string, act: Partial<UnitAct>) => void
  resetUnitActs:     (units: Unit[]) => void
  setEnemyQueue:     (q: string[]) => void
  setPhase:          (p: Phase) => void
  setPreview:        (p: PreviewState | null) => void
  setUndoPos:        (pos: GridPos | null) => void
  setUnits:          (units: Unit[]) => void
  setGrid:           (grid: (string | null)[][]) => void
  setVisible:        (v: Set<string>) => void
  setFogReveal:      (m: Map<string, number>) => void
  markTurnStartHP:   (unitId: string, hp: number) => void
  setBattle:         (b: Partial<GameStore>) => void

  // ── Campaign ─────────────────────────────────────────────
  campWave:    number
  campUnits:   Unit[] | null
  campBuff:    string | null
  setCampWave:  (n: number) => void
  setCampUnits: (u: Unit[] | null) => void
  setCampBuff:  (id: string | null) => void

  // ── Result ───────────────────────────────────────────────
  savedSquad:    (Unit | null)[] | null
  setSavedSquad: (s: (Unit|null)[] | null) => void

  // ── Auth ─────────────────────────────────────────────────
  authUser:    { id: string; email: string; username: string } | null
  setAuthUser: (u: { id: string; email: string; username: string } | null) => void
  forgePendingPowerId:  string | null
  setForgePendingPower: (id: string | null) => void
  refinePendingPowerId: string | null
  setRefinePendingPower:(id: string | null) => void
}

export const useStore = create<GameStore>((set, get) => ({
  // ── Navigation ────────────────────────────────────────────
  screen:    'title',
  setScreen: (s) => set({ screen: s }),

  // ── Build ────────────────────────────────────────────────
  buildSlots:    Array(5).fill(null),
  activeSlot:    null,
  selPowerId:    null,
  powerFilter:   'all',
  setBuildSlot:  (idx, unit) => set(st => { const slots = [...st.buildSlots]; slots[idx] = unit; return { buildSlots: slots } }),
  setActiveSlot: (idx) => set({ activeSlot: idx, selPowerId: null }),
  setSelPowerId: (id)  => set({ selPowerId: id }),
  setPowerFilter:(cat) => set({ powerFilter: cat }),

  // ── Meta ─────────────────────────────────────────────────
  coins:          save.coins,
  diamonds:       save.diamonds,
  forged:         save.forged,
  savedSquads:    save.squads,
  difficulty:     save.difficulty,
  hintsDismissed: save.hintsDismissed,

  addCoins: (n) => { save.coins += n; save.persistCoins(); set({ coins: save.coins, diamonds: save.diamonds }) },
  spendCoins: (n) => { if (save.coins < n) return false; save.coins -= n; save.persistCoins(); set({ coins: save.coins }); return true },
  spendDiamonds: (n) => { if (save.diamonds < n) return false; save.diamonds -= n; save.persistCoins(); set({ diamonds: save.diamonds }); return true },
  addForged: (entry) => { save.forged.push(entry); save.persistForged(); set({ forged: [...save.forged] }) },
  updateForged: (entries) => { save.forged = entries; save.persistForged(); set({ forged: [...save.forged] }) },
  setDifficulty: (d) => { save.difficulty = d; save.persistDiff(); set({ difficulty: d }) },
  dismissHints: () => { save.hintsDismissed = true; save.persistHints(); set({ hintsDismissed: true }) },
  saveSquad: (name) => { save.squads.push({ name, slots: get().buildSlots }); save.persistSquads(); set({ savedSquads: [...save.squads] }) },
  deleteSquad: (idx) => { save.squads.splice(idx, 1); save.persistSquads(); set({ savedSquads: [...save.squads] }) },
  loadSquad: (idx, _fn) => { const sq = save.squads[idx]; if (!sq) return; set({ buildSlots: sq.slots as (Unit|null)[] }) },

  // ── Battle ───────────────────────────────────────────────
  mode:           'quick',
  units:          [],
  grid:           [],
  walls:          new Set(),
  covers:         new Set(),
  round:          1,
  battlePhase:    'idle',
  selectedUnitId: null,
  unitActs:       {},
  enemyQueue:     [],
  phase:          'idle',
  preview:        null,
  undoPos:        null,
  visibleCells:   new Set(),
  fogReveal:      new Map(),
  turnStartHP:    {},
  log:            [],

  setMode:         (m)   => set({ mode: m }),
  setBattlePhase:  (p)   => set({ battlePhase: p }),
  setSelectedUnit: (id)  => set({ selectedUnitId: id, phase: 'idle', preview: null }),
  setUnitAct: (unitId, act) => set(st => ({
    unitActs: { ...st.unitActs, [unitId]: { ...(st.unitActs[unitId] ?? { moved: false, acted: false }), ...act } }
  })),
  resetUnitActs: (units) => {
    const acts: Record<string, UnitAct> = {}
    units.filter(u => u.team === 'player' && u.hp > 0).forEach(u => { acts[u.id] = { moved: false, acted: false } })
    set({ unitActs: acts })
  },
  setEnemyQueue:     (q)   => set({ enemyQueue: q }),
  setPhase:          (p)   => set({ phase: p }),
  setPreview:        (p)   => set({ preview: p }),
  setUndoPos:        (pos) => set({ undoPos: pos }),
  setUnits:          (u)   => set({ units: u }),
  setGrid:           (g)   => set({ grid: g }),
  setVisible:        (v)   => set({ visibleCells: v }),
  setFogReveal:      (m)   => set({ fogReveal: m }),
  markTurnStartHP:   (id, hp) => set(st => ({ turnStartHP: { ...st.turnStartHP, [id]: hp } })),
  setBattle:         (b)   => set(b as any),

  // ── Campaign ─────────────────────────────────────────────
  campWave:    0,
  campUnits:   null,
  campBuff:    null,
  setCampWave:  (n) => set({ campWave: n }),
  setCampUnits: (u) => set({ campUnits: u }),
  setCampBuff:  (id) => set({ campBuff: id }),

  // ── Result ───────────────────────────────────────────────
  savedSquad:    null,
  setSavedSquad: (s) => set({ savedSquad: s }),

  // ── Auth ─────────────────────────────────────────────────
  authUser:    null,
  setAuthUser: (u) => set({ authUser: u }),

  // ── Forge / Refine ────────────────────────────────────────
  forgePendingPowerId:  null,
  setForgePendingPower: (id) => set({ forgePendingPowerId: id }),
  refinePendingPowerId: null,
  setRefinePendingPower:(id) => set({ refinePendingPowerId: id }),
}))