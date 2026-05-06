import type { Unit, TurnAct, Difficulty } from '@data/types'
import { getDiffConfig } from '@data/difficulty'

// ============================================================
// TURN MANAGER
// Manages turn order, speed calculation, and win/lose state.
// Pure logic — no UI, no Phaser, no React.
// Migrated from v0.65 HTML prototype.
// ============================================================

/** Effective speed including haste/slow statuses. */
export function effectiveSpeed(unit: Unit): number {
  if (unit.downside.id === 'slow_react') return -99
  let s = unit.speed
  if (unit.statuses.hasted) s += 6
  if (unit.statuses.slowed) s -= 5
  if (typeof unit.statuses.exhaustion_stack === 'object')
    s -= (unit.statuses.exhaustion_stack as { dur: number }).dur ?? 0
  return s
}

/** Build initial turn order sorted by effective speed (desc). */
export function buildTurnOrder(units: Unit[]): string[] {
  return [...units]
    .sort((a, b) => effectiveSpeed(b) - effectiveSpeed(a))
    .map(u => u.id)
}

/** Advance to the next living unit, wrapping and incrementing round. */
export function advanceTurnIndex(
  current: number,
  order: string[],
  units: Unit[],
  round: number
): { nextIdx: number; newRound: number } {
  if (!order.length) return { nextIdx: 0, newRound: round }

  // Count alive units — if none, return current to let caller handle end
  const anyAlive = units.some(u => u.hp > 0)
  if (!anyAlive) return { nextIdx: current, newRound: round }

  let next    = (current + 1) % order.length
  let loops   = 0
  let wrapped = false

  while (loops < order.length * 2) {
    const u = units.find(x => x.id === order[next])
    if (u && u.hp > 0) break
    if (next === order.length - 1) wrapped = true
    next = (next + 1) % order.length
    loops++
  }

  // Increment round if we wrapped past the end of the order
  const newRound = (next < current || wrapped) ? round + 1 : round
  return { nextIdx: next, newRound }
}

export type WinLoseState = 'ongoing' | 'player_wins' | 'enemy_wins'

export function checkWinLose(units: Unit[]): WinLoseState {
  const playersAlive = units.filter(u => u.team === 'player' && u.hp > 0).length
  const enemiesAlive = units.filter(u => u.team === 'enemy'  && u.hp > 0).length
  if (enemiesAlive === 0) return 'player_wins'
  if (playersAlive === 0) return 'enemy_wins'
  return 'ongoing'
}

/** Fresh turn-action state. */
export function freshAct(): TurnAct {
  return { moved: false, punched: false, abilitied: false, doubleUsed: false }
}

/** AI think delay in ms for the current difficulty. */
export function aiDelay(difficulty: Difficulty): number {
  return getDiffConfig(difficulty).aiDelay
}