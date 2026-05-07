import type { Unit, GridPos } from '@data/types'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { applyStartStatuses } from '@systems/StatusEngine'
import { assignPersonality } from '@systems/UnitFactory'

// ============================================================
// TUTORIAL BATTLE SETUP
// 2v2 on a 9x9 grid. Simpler than the real 15x15 5v5.
// Enemies are weakened and predictable for learning purposes.
// ============================================================

export const TUTORIAL_GRID_SIZE = 9

export interface TutorialMapData {
  grid:   (string | null)[][]
  walls:  Set<string>
  covers: Set<string>
}

export function buildTutorialMap(): TutorialMapData {
  const grid: (string | null)[][] = Array.from({ length: TUTORIAL_GRID_SIZE }, () => Array(TUTORIAL_GRID_SIZE).fill(null))
  const walls  = new Set<string>()
  const covers = new Set<string>()

  // Simple wall layout — two small clusters in the middle
  const wallTiles: [number, number][] = [[3,3],[3,4],[5,4],[5,5]]
  wallTiles.forEach(([r, c]) => walls.add(`${r},${c}`))
  // A couple of cover tiles
  const coverTiles: [number, number][] = [[2,5],[6,3]]
  coverTiles.forEach(([r, c]) => covers.add(`${r},${c}`))

  return { grid, walls, covers }
}

export function buildTutorialUnits(): Unit[] {
  const strikePower  = ALL_POWERS.find(p => p.id === 'strike')!
  const sniperPower  = ALL_POWERS.find(p => p.id === 'sniper_shot')!
  const drainCurse   = ALL_CURSES.find(c => c.id === 'health_drain')!
  const aimCurse     = ALL_CURSES.find(c => c.id === 'unstable_aim')!
  const glassCurse   = ALL_CURSES.find(c => c.id === 'glass_body')!
  const slowCurse    = ALL_CURSES.find(c => c.id === 'slow_react')!

  const units: Unit[] = [
    // Player unit 1 — Striker
    {
      id: 'tut_player_0', name: 'UNIT 1', icon: '🧍', team: 'player',
      power: strikePower, downside: drainCurse,
      maxHp: 100, hp: 100, speed: 12, vision: 5,
      personality: assignPersonality(strikePower, drainCurse),
      statuses: {}, turnCount: 0, pendingAbility: null,
      pos: { r: 4, c: 0 },
    },
    // Player unit 2 — Sniper
    {
      id: 'tut_player_1', name: 'UNIT 2', icon: '🤖', team: 'player',
      power: sniperPower, downside: aimCurse,
      maxHp: 100, hp: 100, speed: 10, vision: 5,
      personality: assignPersonality(sniperPower, aimCurse),
      statuses: {}, turnCount: 0, pendingAbility: null,
      pos: { r: 2, c: 0 },
    },
    // Enemy 1 — Weak melee (glass body — takes more damage, good for teaching)
    {
      id: 'tut_enemy_0', name: 'FOE 1', icon: '👹', team: 'enemy',
      power: strikePower, downside: glassCurse,
      maxHp: 60, hp: 60, speed: 6, vision: 5,
      personality: 'aggressive',
      statuses: {}, turnCount: 0, pendingAbility: null,
      pos: { r: 4, c: 8 },
    },
    // Enemy 2 — Slow (always acts last, easy to learn against)
    {
      id: 'tut_enemy_1', name: 'FOE 2', icon: '👺', team: 'enemy',
      power: strikePower, downside: slowCurse,
      maxHp: 60, hp: 60, speed: 2, vision: 5,
      personality: 'defensive',
      statuses: {}, turnCount: 0, pendingAbility: null,
      pos: { r: 6, c: 8 },
    },
  ]

  units.forEach(u => applyStartStatuses(u))
  return units
}