import type { Unit, StatusKey, StatusEffect, UnitStatuses } from '@data/types'

// ============================================================
// STATUS ENGINE
// All status effect processing: ticking, permanent statuses,
// DoT, regen, random effects.
// UI-agnostic — returns mutations on Unit objects only.
// Migrated from v0.65 HTML prototype processTurnStart().
// ============================================================

const PERMANENT_STATUSES: Partial<Record<StatusKey, (u: Unit) => boolean>> = {
  poison:    u => u.downside.id === 'toxic_body',
  slowed:    u => u.downside.id === 'delayed_reflex',
  confused:  u => u.downside.id === 'fragile_mind',
  invisible: u => u.downside.id === 'ghost_body',
}

/** Decrement all non-permanent status durations and remove expired ones. */
export function tickStatuses(unit: Unit): void {
  const expired: StatusKey[] = []
  for (const [key, val] of Object.entries(unit.statuses) as [StatusKey, StatusEffect | boolean][]) {
    if (!val) continue
    if (PERMANENT_STATUSES[key]?.(unit)) continue
    if (typeof (val as StatusEffect).dur === 'number') {
      ;(val as StatusEffect).dur -= 1
      if ((val as StatusEffect).dur <= 0) expired.push(key)
    }
  }
  expired.forEach(k => delete unit.statuses[k])
}

/** Apply start-of-turn passive statuses based on downside id. */
export function applyStartStatuses(unit: Unit): void {
  const id = unit.downside.id
  if (id === 'fragile_mind')   unit.statuses.confused   = { dur: 99 }
  if (id === 'toxic_body')     unit.statuses.poison     = { dur: 99, dmg: 8 }
  if (id === 'delayed_reflex') unit.statuses.slowed     = { dur: 99 }
  if (id === 'ghost_body')     unit.statuses.invisible  = { dur: 99 }
}

/** Returns the DoT damage this unit should take at turn start, or 0. */
export function getDoTDamage(unit: Unit): { poison: number; burn: number } {
  const poisonDmg = unit.statuses.poison
    ? ((unit.statuses.poison as StatusEffect).dmg ?? 8)
    : 0
  let burnDmg = unit.statuses.burn ? 12 : 0
  if (burnDmg > 0 && unit.downside.id === 'combustible') burnDmg = Math.round(burnDmg * 1.75)
  return { poison: poisonDmg, burn: burnDmg }
}

/** Returns regen amount this unit gains at turn start, or 0. */
export function getRegenAmount(unit: Unit): number {
  return unit.statuses.regen ? Math.min(10, unit.maxHp - unit.hp) : 0
}

const RAND_STATUS_OPTIONS: Array<(u: Unit) => void> = [
  u => { u.statuses.empowered = { dur: 1 } },
  u => { u.statuses.hasted    = { dur: 1 } },
  u => { u.statuses.stunned   = { dur: 1 } },
  u => { u.statuses.poison    = { dur: 1, dmg: 10 } },
  u => { u.statuses.confused  = { dur: 1 } },
  u => { u.statuses.shielded  = { dur: 1 } },
  u => { u.statuses.regen     = { dur: 1 } },
]

/** Apply a random status (for unstable_core downside). */
export function applyRandomStatus(unit: Unit): StatusKey {
  const idx = Math.floor(Math.random() * RAND_STATUS_OPTIONS.length)
  RAND_STATUS_OPTIONS[idx](unit)
  const keys: StatusKey[] = ['empowered', 'hasted', 'stunned', 'poison', 'confused', 'shielded', 'regen']
  return keys[idx]
}

/** True if unit is stunned for this turn. */
export function isStunned(unit: Unit): boolean {
  return !!(unit.statuses.stunned as StatusEffect)?.dur && (unit.statuses.stunned as StatusEffect).dur > 0
}

/** True if unit is invisible (can be permanent or timed). */
export function isInvisible(unit: Unit): boolean {
  const v = unit.statuses.invisible
  if (!v) return false
  if (typeof (v as StatusEffect).dur === 'number') return (v as StatusEffect).dur > 0
  return true
}

/** Break invisibility on offensive action (unless ghost_body). */
export function breakInvisOnAttack(unit: Unit): void {
  if (unit.downside.id !== 'ghost_body' && unit.statuses.invisible) {
    delete unit.statuses.invisible
  }
}

/** Apply adrenal crash phases. */
export function applyAdrenalCrash(unit: Unit): 'empowered' | 'stunned' | null {
  if (unit.downside.id !== 'adrenal_crash') return null
  if (unit.turnCount === 1) {
    unit.statuses.empowered = { dur: 1 }
    return 'empowered'
  }
  if (unit.turnCount === 2) {
    unit.statuses.stunned = { dur: 1 }
    return 'stunned'
  }
  return null
}
