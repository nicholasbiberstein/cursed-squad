// ============================================================
// CURSED SQUAD — Shared Types
// All data shapes used across systems, AI, and UI.
// UI-agnostic: nothing here imports from React or Phaser.
// ============================================================

// ── Rarity ──────────────────────────────────────────────────
export type Rarity = 'common' | 'rare' | 'epic' | 'legendary' | 'mythical'

export interface RarityConfig {
  label:       string
  color:       string   // CSS variable string, e.g. 'var(--r-rare)'
  coinCost:    number
  diaCost:     number
  rerollCost:  number
  refineCost:  number
  eventOnly?:  boolean
}

// ── Categories ───────────────────────────────────────────────
export type PowerCategory = 'melee' | 'ranged' | 'reinforcing' | 'control' | 'perception' | 'mobility'
export type CurseCategory  = 'physical' | 'mental' | 'temporal' | 'visibility' | 'instability'
export type SynergyTag     = 'high-risk' | 'positioning' | 'unstable' | 'defensive' | 'aggressive' | 'utility' | 'stealth'

// ── Ability types (determines resolveEffect branch) ──────────
export type AbilityType =
  | 'damage' | 'dash' | 'line' | 'aoe' | 'leech'
  | 'heal' | 'shield' | 'selfbuff' | 'double' | 'push'
  | 'mark' | 'slow' | 'cleanse' | 'stealth' | 'scan'
  | 'scan_all' | 'reveal' | 'teleport' | 'chain' | 'aoe_buff'

// ── Power data ───────────────────────────────────────────────
export interface Power {
  id:          string
  name:        string
  icon:        string
  rarity:      Rarity
  cat:         PowerCategory
  type:        AbilityType
  range:       number
  damage?:     number
  heal?:       number
  desc:        string
  detail?:     string
  applyS?:     [string, number, number?]   // [statusKey, duration, dmgPerTick?]
  isAmbush?:   boolean

  // Refinement fields (applied at unit construction, not on base data)
  _rangeBonus?:   number
  _moveBonus?:    number
  _radiusBonus?:  number
  _shieldDur?:    number
  _markDur?:      number
  _slowDur?:      number
  _revealDur?:    number
  _buffDur?:      number
  _pushDist?:     number
  _leechRate?:    number
  _ambushBonus?:  number
  _accuracyBonus?:number
  _armorShred?:   boolean
  _reflect?:      number
  _fastInvis?:    boolean
  _regenOnCleanse?:boolean
  _noStunAfter?:  boolean
  _extraPunch?:   boolean
  _scanStun?:     boolean
  _entryStrike?:  boolean
  _buffHeal?:     number
  _overheal?:     number
  _noSelfAoe?:    boolean
}

// ── Curse data ───────────────────────────────────────────────
export interface Curse {
  id:       string
  name:     string
  icon:     string
  rarity:   Rarity
  cat:      CurseCategory
  desc:     string
  detail?:  string
  synergy:  SynergyTag[]
}

// ── Forged card (player's collection entry) ──────────────────
export interface ForgedEntry {
  powerId:      string
  curseId:      string
  rerollCount:  number
  refinements:  string[]   // array of refinement IDs
  isStarter?:   boolean
}

// ── Refinement ───────────────────────────────────────────────
export interface Refinement {
  id:   string
  name: string
  desc: string
}

// ── Unit status effects ──────────────────────────────────────
export interface StatusEffect {
  dur: number    // 99 = permanent (downside-driven)
  dmg?: number   // for poison/burn
  val?: number   // for reflect etc.
}

export type StatusKey =
  | 'stunned' | 'shielded' | 'marked' | 'poison' | 'burn'
  | 'regen' | 'hasted' | 'slowed' | 'weakened' | 'empowered'
  | 'confused' | 'invisible' | 'reveal' | 'stabilized' | 'focused'
  | 'reflect' | 'exhaustion_stack' | 'burned'

export type UnitStatuses = Partial<Record<StatusKey, StatusEffect | boolean>>

// ── Unit (in-battle) ─────────────────────────────────────────
export type Team = 'player' | 'enemy'
export type Personality = 'aggressive' | 'defensive' | 'trickster'

export interface GridPos {
  r: number
  c: number
}

export interface PendingAbility {
  targets: Unit[]
  center:  GridPos | null
  power:   Power
}

export interface Unit {
  id:              string
  name:            string
  icon:            string
  team:            Team
  power:           Power
  downside:        Curse
  maxHp:           number
  hp:              number
  speed:           number
  vision:          number
  personality:     Personality
  statuses:        UnitStatuses
  turnCount:       number
  pendingAbility:  PendingAbility | null
  pos:             GridPos
  _dmgBonus?:      number   // wave difficulty bonus for enemies
}

// ── Game phase ───────────────────────────────────────────────
export type Phase = 'idle' | 'move' | 'punch' | 'ability' | 'preview'
export type GameMode  = 'quick' | 'campaign'
export type Difficulty = 'easy' | 'standard' | 'hard'

// ── Turn action state ────────────────────────────────────────
export interface TurnAct {
  moved:       boolean
  punched:     boolean
  abilitied:   boolean
  doubleUsed:  boolean
}

// ── Preview state ─────────────────────────────────────────────
export interface PreviewState {
  unit:    Unit
  targets: Unit[]
  center:  GridPos | null
  power:   Power
}

// ── Difficulty config ────────────────────────────────────────
export interface DifficultyConfig {
  hpMult:       number
  dmgMult:      number
  aiDelay:      number   // ms between AI steps
  aiSmartness:  number   // 0–1
  rewardMult:   number
  label:        string
}

// ── Campaign wave ────────────────────────────────────────────
export interface WaveDef {
  label:    string
  icon:     string
  desc:     string
  hpBonus:  number
  dmgBonus: number
}

// ── Campaign inter-battle buff ───────────────────────────────
export interface CampBuff {
  id:    string
  icon:  string
  name:  string
  desc:  string
  apply: (units: Unit[]) => void
}

// ── Save data shape (for SaveManager) ───────────────────────
export interface SaveData {
  coins:           number
  diamonds:        number
  forged:          ForgedEntry[]
  squads:          SavedSquad[]
  difficulty:      Difficulty
  hintsDismissed:  boolean
}

export interface SavedSquad {
  name:  string
  slots: (Unit | null)[]
}