import type { Unit, Power, GridPos, Difficulty } from '@data/types'
import { getDiffConfig } from '@data/difficulty'
import { hasLoS } from '@systems/VisibilityEngine'
import { moveUnitOnGrid } from '@systems/MapBuilder'

// ============================================================
// PERSONALITY AI
// Three strategies: aggressive | defensive | trickster.
// Returns an action descriptor — the calling code executes it.
// Pure logic — no UI, no Phaser, no React.
// Migrated from v0.65 HTML prototype runEnemyTurn().
// ============================================================

export type AIActionType =
  | 'ability'
  | 'punch'
  | 'selfbuff'
  | 'heal'
  | 'skip'      // stunned / confused random act
  | 'idle'

export interface AIAction {
  type:       AIActionType
  targets:    Unit[]
  center:     GridPos | null
  power?:     Power
  logMsg:     string
}

// ── Helpers ───────────────────────────────────────────────────

function rnd(n: number): number { return Math.floor(Math.random() * n) }

function mdist(a: Unit, b: Unit): number {
  return Math.abs(a.pos.r - b.pos.r) + Math.abs(a.pos.c - b.pos.c)
}

function mDist2(p1: GridPos, p2: GridPos): number {
  return Math.max(Math.abs(p1.r - p2.r), Math.abs(p1.c - p2.c))
}

function pickTarget(
  unit: Unit,
  targets: Unit[],
  strategy: 'low_hp' | 'high_dmg' | 'nearest'
): Unit | null {
  if (!targets.length) return null
  if (strategy === 'low_hp')   return [...targets].sort((a, b) => a.hp - b.hp)[0]
  if (strategy === 'high_dmg') return [...targets].sort((a, b) => (b.power.damage ?? 0) - (a.power.damage ?? 0))[0]
  return [...targets].sort((a, b) => mdist(unit, a) - mdist(unit, b))[0]
}

/** Move an AI unit toward a target, up to `steps` tiles. */
export function aiMove(
  unit: Unit,
  target: Unit,
  steps: number,
  grid: (string | null)[][],
  walls: Set<string>
): void {
  if (unit.downside.id === 'locked_pos') return
  let moved = 0
  while (moved < steps) {
    const dist = mdist(unit, target)
    if (dist <= 1) break
    const dr = Math.sign(target.pos.r - unit.pos.r)
    const dc = Math.sign(target.pos.c - unit.pos.c)
    const primary = Math.abs(target.pos.r - unit.pos.r) >= Math.abs(target.pos.c - unit.pos.c)
      ? [{ r: unit.pos.r + dr, c: unit.pos.c }, { r: unit.pos.r, c: unit.pos.c + dc }, { r: unit.pos.r - dr, c: unit.pos.c }]
      : [{ r: unit.pos.r, c: unit.pos.c + dc }, { r: unit.pos.r + dr, c: unit.pos.c }, { r: unit.pos.r, c: unit.pos.c - dc }]
    const GSIZE = grid.length
    let stepped = false
    for (const { r, c } of primary) {
      if (r >= 0 && r < GSIZE && c >= 0 && c < GSIZE && !grid[r][c] && !walls.has(`${r},${c}`)) {
        moveUnitOnGrid(unit, r, c, grid)
        moved++; stepped = true; break
      }
    }
    if (!stepped) break
  }
}

/** Decide what an enemy does on its turn. */
export function decideAction(
  unit: Unit,
  playerUnits: Unit[],
  allUnits: Unit[],
  grid: (string | null)[][],
  walls: Set<string>,
  difficulty: Difficulty
): AIAction {
  const alive = playerUnits.filter(u => u.hp > 0)
  if (!alive.length) return { type: 'idle', targets: [], center: null, logMsg: '' }

  const dc = getDiffConfig(difficulty)

  // Confused: 30% random stumble
  if (unit.statuses.confused && Math.random() < 0.3) {
    return { type: 'skip', targets: [], center: null, logMsg: `${unit.name} confused — acts randomly!` }
  }

  const pwr = unit.power
  const pers = unit.personality

  // ── DEFENSIVE ──────────────────────────────────────────────
  if (pers === 'defensive') {
    // Self-buff first
    if (['selfbuff', 'shield'].includes(pwr.type)) {
      return { type: 'selfbuff', targets: [], center: null, power: pwr, logMsg: `${unit.name} defends!` }
    }
    // Heal most wounded ally
    if (pwr.type === 'heal') {
      const allies = allUnits.filter(u => u.team === 'enemy' && u.hp > 0).sort((a, b) => a.hp - b.hp)
      const ht = allies[0]
      if (ht && mdist(unit, ht) <= (pwr.range ?? 3)) {
        return { type: 'heal', targets: [ht], center: ht.pos, power: pwr, logMsg: `${unit.name} heals ${ht.name}!` }
      }
      aiMove(unit, ht ?? alive[0], 2, grid, walls)
    } else {
      aiMove(unit, alive[0], 1, grid, walls)
    }
    const t = pickTarget(unit, alive, 'low_hp')!
    const d2 = mdist(unit, t)
    if (pwr.range >= 3 && d2 <= pwr.range) {
      return { type: 'ability', targets: [t], center: t.pos, power: pwr, logMsg: `${unit.name} uses ${pwr.name}!` }
    }
    if (d2 === 1) return { type: 'punch', targets: [t], center: t.pos, logMsg: `${unit.name} punches ${t.name}!` }
    return { type: 'idle', targets: [], center: null, logMsg: '' }
  }

  // ── TRICKSTER ──────────────────────────────────────────────
  if (pers === 'trickster') {
    const t = pickTarget(unit, alive, 'high_dmg')!
    if (['mark', 'slow', 'reveal', 'stealth', 'double'].includes(pwr.type)) {
      if ((pwr.type === 'stealth') && !unit.statuses.invisible) {
        return { type: 'selfbuff', targets: [], center: null, power: pwr, logMsg: `${unit.name} vanishes!` }
      }
      if (['mark', 'slow', 'reveal'].includes(pwr.type) && mdist(unit, t) <= pwr.range) {
        return { type: 'ability', targets: [t], center: t.pos, power: pwr, logMsg: `${unit.name} uses ${pwr.name}!` }
      }
      aiMove(unit, t, 2, grid, walls)
    } else {
      if (unit.statuses.invisible) aiMove(unit, t, 3, grid, walls)
      else aiMove(unit, t, 2, grid, walls)
    }
    const d2 = mdist(unit, t)
    if (d2 <= (pwr.range ?? 1)) {
      return { type: 'ability', targets: [t], center: t.pos, power: pwr, logMsg: `${unit.name} uses ${pwr.name}!` }
    }
    if (d2 === 1) return { type: 'punch', targets: [t], center: t.pos, logMsg: `${unit.name} punches ${t.name}!` }
    return { type: 'idle', targets: [], center: null, logMsg: '' }
  }

  // ── AGGRESSIVE (default) ────────────────────────────────────
  {
    const t = pickTarget(unit, alive, 'low_hp')!
    aiMove(unit, t, 2, grid, walls)

    const d2 = mdist(unit, t)
    const inRange = pwr.type === 'line'
      ? hasLoS(unit.pos, t.pos, walls)
      : d2 <= (pwr.range ?? 1)

    if (inRange) {
      if (pwr.type === 'aoe') {
        const aoeTgts = alive.filter(x => mDist2(x.pos, t.pos) <= 1)
        // On hard, use AOE for 2+ targets; on easy, require 3+
        const threshold = dc.aiSmartness > 0.8 ? 2 : dc.aiSmartness > 0.5 ? 2 : 3
        if (aoeTgts.length >= threshold || unit.hp < 35) {
          return { type: 'ability', targets: aoeTgts, center: t.pos, power: pwr, logMsg: `${unit.name} uses ${pwr.name}!` }
        }
        if (d2 === 1) return { type: 'punch', targets: [t], center: t.pos, logMsg: `${unit.name} punches ${t.name}!` }
        return { type: 'ability', targets: [t], center: t.pos, power: pwr, logMsg: `${unit.name} uses ${pwr.name}!` }
      }
      return { type: 'ability', targets: [t], center: t.pos, power: pwr, logMsg: `${unit.name} uses ${pwr.name}!` }
    }

    if (d2 === 1) return { type: 'punch', targets: [t], center: t.pos, logMsg: `${unit.name} punches ${t.name}!` }
    return { type: 'idle', targets: [], center: null, logMsg: '' }
  }
}
