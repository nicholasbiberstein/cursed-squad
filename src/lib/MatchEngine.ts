// ============================================================
// MATCH ENGINE
// Server-side battle simulation for async multiplayer.
// Runs a complete 5v5 battle and returns the replay.
// Uses the same systems as the single-player game.
// ============================================================

import type { Unit, GridPos } from '@data/types'
import { buildMap, placeUnits, moveUnitOnGrid, GSIZE } from '@systems/MapBuilder'
import { buildTurnOrder, checkWinLose } from '@systems/TurnManager'
import { computeVisibility, revealUnit, hasLoS } from '@systems/VisibilityEngine'
import { applyDamage, applyBackfire, shouldMiss } from '@systems/CombatEngine'
import {
  tickStatuses, getDoTDamage, getRegenAmount,
  isStunned, applyRandomStatus, breakInvisOnAttack,
} from '@systems/StatusEngine'
import { decideAction, aiMove } from '@ai/PersonalityAI'

export interface ReplayEvent {
  round:   number
  unitId:  string
  action:  string
  targets: string[]
  damage?: number
  pos?:    { r: number; c: number }
}

export interface BattleResult {
  winner:    'a' | 'b' | 'draw'
  rounds:    number
  replay:    ReplayEvent[]
  survivors: { a: number; b: number }
}

const MAX_ROUNDS = 30  // Prevent infinite battles

export function simulateBattle(unitsA: Unit[], unitsB: Unit[]): BattleResult {
  const { grid, walls, covers } = buildMap()
  const allUnits = [...unitsA, ...unitsB]
  const replay:   ReplayEvent[] = []
  const fogReveal = new Map<string, number>()

  placeUnits(allUnits, grid)

  const turnOrder = buildTurnOrder(allUnits)
  let turnIdx     = 0
  let round       = 1

  function isDead(u: Unit) { return u.hp <= 0 }

  function curUnit(): Unit | undefined {
    return allUnits.find(u => u.id === turnOrder[turnIdx])
  }

  function advanceTurn() {
    let next  = (turnIdx + 1) % turnOrder.length
    let loops = 0
    while (loops < turnOrder.length) {
      const u = allUnits.find(x => x.id === turnOrder[next])
      if (u && !isDead(u)) break
      next = (next + 1) % turnOrder.length
      loops++
    }
    if (next <= turnIdx) round++
    turnIdx = next
  }

  function dealDamage(attacker: Unit, target: Unit, dmg: number) {
    if (isDead(target)) return
    const res = applyDamage(attacker, target, dmg)
    replay.push({
      round, unitId: attacker.id, action: 'damage',
      targets: [target.id], damage: res.amount,
    })
    if (res.killed) {
      target.hp = 0
      grid[target.pos.r][target.pos.c] = null
    }
  }

  function processTurnStart(u: Unit) {
    u.turnCount++
    const { poison, burn } = getDoTDamage(u)
    if (poison > 0) { u.hp = Math.max(0, u.hp - poison); replay.push({ round, unitId: u.id, action: 'poison', targets: [], damage: poison }) }
    if (burn   > 0) { u.hp = Math.max(0, u.hp - burn);   replay.push({ round, unitId: u.id, action: 'burn',   targets: [], damage: burn   }) }
    const regen = getRegenAmount(u)
    if (regen  > 0) { u.hp += regen; replay.push({ round, unitId: u.id, action: 'regen', targets: [], damage: -regen }) }
    if (u.downside.id === 'health_drain') { u.hp = Math.max(0, u.hp - 8); }
    if (u.downside.id === 'unstable_core') applyRandomStatus(u)
    tickStatuses(u)
  }

  function runUnitTurn(u: Unit) {
    if (isDead(u)) return

    processTurnStart(u)
    if (isDead(u)) { grid[u.pos.r][u.pos.c] = null; return }
    if (isStunned(u)) {
      replay.push({ round, unitId: u.id, action: 'stunned', targets: [] })
      return
    }

    const enemies  = allUnits.filter(t => t.team !== u.team && !isDead(t))
    const visible  = computeVisibility(allUnits, walls, fogReveal)
    const action   = decideAction(u, enemies, allUnits, grid, walls, 'standard')

    switch (action.type) {
      case 'ability':
        if (!action.power) break
        if (shouldMiss(u, action.power)) {
          replay.push({ round, unitId: u.id, action: 'miss', targets: [] }); break
        }
        breakInvisOnAttack(u)
        action.targets.forEach(t => {
          if (action.power!.range > 1 && !hasLoS(u.pos, t.pos, walls)) return
          dealDamage(u, t, Math.round((action.power!.damage ?? 20) * (u.statuses.empowered ? 1.5 : 1)))
        })
        applyBackfire(u)
        replay.push({ round, unitId: u.id, action: 'ability', targets: action.targets.map(t => t.id), pos: u.pos })
        break

      case 'punch':
        if (action.targets[0]) {
          const t = action.targets[0]
          const dmg = Math.max(1, 12)
          t.hp = Math.max(0, t.hp - dmg)
          if (isDead(t)) { t.hp = 0; grid[t.pos.r][t.pos.c] = null }
          replay.push({ round, unitId: u.id, action: 'punch', targets: [t.id], damage: dmg })
        }
        break

      case 'selfbuff':
        if (u.power.type === 'shield') u.statuses.shielded = { dur: 2 }
        replay.push({ round, unitId: u.id, action: 'selfbuff', targets: [] })
        break

      case 'idle':
      default:
        break
    }
  }

  // ── Main battle loop ──────────────────────────────────────
  while (round <= MAX_ROUNDS) {
    const result = checkWinLose(allUnits)
    if (result !== 'ongoing') break

    const u = curUnit()
    if (u && !isDead(u)) runUnitTurn(u)
    advanceTurn()
  }

  const aAlive = allUnits.filter(u => u.team === 'player' && !isDead(u)).length
  const bAlive = allUnits.filter(u => u.team === 'enemy'  && !isDead(u)).length

  return {
    winner:    aAlive > bAlive ? 'a' : bAlive > aAlive ? 'b' : 'draw',
    rounds:    round,
    replay,
    survivors: { a: aAlive, b: bAlive },
  }
}