import type { Unit, Power, GridPos, StatusEffect } from '@data/types'
import { breakInvisOnAttack } from './StatusEngine'

// ============================================================
// COMBAT ENGINE
// Damage, healing, push, backfire, and ability resolution.
// Returns structured results instead of calling UI directly.
// UI layer reads results and triggers animations separately.
// Migrated from v0.65 HTML prototype resolveEffect().
// ============================================================

export interface DamageResult {
  unit:    Unit
  amount:  number
  blocked: number
  shieldAbsorbed: number
  killed:  boolean
  soulboundExplode?: boolean
}

export interface HealResult {
  unit:   Unit
  amount: number
  corrupted: boolean  // corrupt_heal curse turned it to poison
}

export interface AbilityResult {
  damage:   DamageResult[]
  heals:    HealResult[]
  statuses: Array<{ unit: Unit; key: string; dur: number }>
  pushes:   Array<{ unit: Unit; fromPos: GridPos; dist: number }>
  logs:     string[]
}

// ── Damage multipliers ────────────────────────────────────────
export function calcDamageMultiplier(attacker: Unit, power: Power): number {
  const emp    = attacker.statuses.empowered ? 1.5 : 1
  const weak   = attacker.statuses.weakened  ? 0.6 : 1
  const ambush = (power.isAmbush && attacker.statuses.invisible) ? ((power._ambushBonus ?? 0.5) + 1) : 1
  const berserk= attacker.downside.id === 'berserker' ? 1.75 : 1
  return emp * weak * ambush * berserk
}

export function calcIncomingDamage(target: Unit, rawDmg: number): { final: number; shieldAbsorbed: number } {
  let dmg = rawDmg
  if (target.statuses.marked) dmg = Math.floor(dmg * 1.5)
  if (target.downside.id === 'glass_body') dmg = Math.floor(dmg * 1.5)
  if (target.downside.id === 'brittle')    dmg = Math.floor(dmg * 1.25)
  let shieldAbsorbed = 0
  if (target.statuses.shielded) {
    shieldAbsorbed = Math.floor(dmg * 0.5)
    dmg = dmg - shieldAbsorbed
    delete target.statuses.shielded
    delete target.statuses.reflect
  }
  return { final: Math.max(1, dmg), shieldAbsorbed }
}

export function applyDamage(attacker: Unit, target: Unit, rawDmg: number): DamageResult {
  const { final, shieldAbsorbed } = calcIncomingDamage(target, rawDmg)
  target.hp = Math.max(0, target.hp - final)

  // Mirror curse
  if (target.downside.id === 'mirror_curse') {
    const reflect = Math.floor(final * 0.3)
    attacker.hp = Math.max(0, attacker.hp - reflect)
  }

  return {
    unit:           target,
    amount:         final,
    blocked:        shieldAbsorbed,
    shieldAbsorbed: shieldAbsorbed,
    killed:         target.hp <= 0,
    soulboundExplode: target.hp <= 0 && target.downside.id === 'soulbound',
  }
}

export function applyHeal(caster: Unit, target: Unit, amount: number): HealResult {
  if (target.downside.id === 'corrupt_heal') {
    target.statuses.poison = { dur: 2, dmg: 8 }
    return { unit: target, amount: 0, corrupted: true }
  }
  const before = target.hp
  target.hp = Math.min(target.maxHp + (caster.power._overheal ?? 0), target.hp + amount)
  return { unit: target, amount: target.hp - before, corrupted: false }
}

export function applyBackfire(unit: Unit): number {
  let dmg = 0
  if (unit.downside.id === 'backfire'   && !unit.statuses.stabilized) dmg = Math.max(dmg, 10)
  if (unit.downside.id === 'berserker'  && !unit.statuses.stabilized) dmg = Math.max(dmg, 15)
  if (unit.downside.id === 'blood_cost' && !unit.statuses.stabilized) dmg = Math.max(dmg, 12)
  if (dmg > 0) unit.hp = Math.max(0, unit.hp - dmg)
  return dmg
}

export function applyPush(
  unit: Unit,
  fromPos: GridPos,
  grid: (string | null)[][],
  walls: Set<string>,
  dist = 2
): GridPos {
  const dr = Math.sign(unit.pos.r - fromPos.r)
  const dc = Math.sign(unit.pos.c - fromPos.c)
  if (!dr && !dc) return unit.pos

  let pr = unit.pos.r, pc = unit.pos.c
  const GSIZE = grid.length

  for (let i = 0; i < dist; i++) {
    const nr = pr + dr, nc = pc + dc
    if (
      nr >= 0 && nr < GSIZE &&
      nc >= 0 && nc < GSIZE &&
      !grid[nr][nc] &&
      !walls.has(`${nr},${nc}`)
    ) {
      grid[pr][pc] = null
      grid[nr][nc] = unit.id
      pr = nr; pc = nc
    } else break
  }

  unit.pos = { r: pr, c: pc }
  return unit.pos
}

// ── Ability miss check ────────────────────────────────────────
export function shouldMiss(unit: Unit, power: Power): boolean {
  if (unit.downside.id !== 'unstable_aim') return false
  if (unit.statuses.focused || unit.statuses.stabilized) return false
  const missChance = Math.max(0.05, 0.25 - (power._accuracyBonus ?? 0))
  return Math.random() < missChance
}

// ── Stun-after check ─────────────────────────────────────────
export function applyStunAfter(unit: Unit): boolean {
  if (
    unit.downside.id === 'stunned_after' &&
    !unit.statuses.stabilized &&
    !unit.power._noStunAfter
  ) {
    unit.statuses.stunned = { dur: 1 }
    return true
  }
  return false
}