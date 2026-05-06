import type { Unit, GridPos } from '@data/types'

// ============================================================
// VISIBILITY ENGINE
// Fog of war: Bresenham LoS, vision casting, unit reveal.
// UI-agnostic — returns Sets of visible cell keys.
// Migrated from v0.65 HTML prototype.
// ============================================================

const GSIZE = 15

/** Bresenham line-of-sight check between two grid positions. */
export function hasLoS(
  from: GridPos,
  to: GridPos,
  walls: Set<string>
): boolean {
  let x0 = from.c, y0 = from.r
  const x1 = to.c, y1 = to.r
  const dx = Math.abs(x1 - x0), dy = Math.abs(y1 - y0)
  const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1
  let err = dx - dy

  while (x0 !== x1 || y0 !== y1) {
    const e2 = 2 * err
    if (e2 > -dy) { err -= dy; x0 += sx }
    if (e2 < dx)  { err += dx; y0 += sy }
    if (x0 === x1 && y0 === y1) break
    if (walls.has(`${y0},${x0}`)) return false
  }
  return true
}

/** Flood vision from a position with a given range. */
export function castVision(
  from: GridPos,
  range: number,
  walls: Set<string>,
  visible: Set<string>
): void {
  for (let r = 0; r < GSIZE; r++) {
    for (let c = 0; c < GSIZE; c++) {
      const dist = Math.abs(r - from.r) + Math.abs(c - from.c)
      if (dist <= range && (dist <= 1 || hasLoS(from, { r, c }, walls))) {
        visible.add(`${r},${c}`)
      }
    }
  }
}

/** Compute the full visible cell set for the player's squad. */
export function computeVisibility(
  units: Unit[],
  walls: Set<string>,
  fogReveal: Map<string, number>
): Set<string> {
  const visible = new Set<string>()

  // Player units cast vision
  for (const u of units) {
    if (u.team !== 'player' || u.hp <= 0) continue
    const range = u.statuses.invisible ? 1 : u.vision
    castVision(u.pos, range, walls, visible)
  }

  // Area reveals (from scan abilities)
  for (const [key, turns] of fogReveal.entries()) {
    if (turns > 0) visible.add(key)
  }

  return visible
}

/** Tick the fog-reveal map (decrement each entry by 1). */
export function tickFogReveal(fogReveal: Map<string, number>): void {
  for (const [key, val] of fogReveal.entries()) {
    if (val > 0) fogReveal.set(key, val - 1)
  }
}

/** Check if an enemy unit is currently visible to the player. */
export function isEnemyVisible(
  unit: Unit,
  visible: Set<string>,
  fogReveal: Map<string, number>
): boolean {
  if (unit.hp <= 0) return false
  if (unit.statuses.invisible && !unit.statuses.reveal) return false
  if ((fogReveal.get(unit.id) ?? 0) > 0) return true
  return visible.has(`${unit.pos.r},${unit.pos.c}`)
}

/** Reveal a unit for N turns (scan/tracker abilities). */
export function revealUnit(
  unit: Unit,
  turns: number,
  fogReveal: Map<string, number>
): void {
  unit.statuses.reveal = { dur: turns }
  fogReveal.set(unit.id, (fogReveal.get(unit.id) ?? 0) + turns)
}
