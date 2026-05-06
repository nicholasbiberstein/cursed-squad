import type { Unit } from '@data/types'

// ============================================================
// MAP BUILDER
// Procedural 15×15 map with wall clusters and cover tiles.
// Returns walls Set, covers Set, and initialised grid.
// Migrated from v0.65 HTML prototype.
// ============================================================

export const GSIZE = 15

export interface MapData {
  grid:   (string | null)[][]
  walls:  Set<string>
  covers: Set<string>
}

const WALL_CLUSTERS = [
  [{ r: 3, c: 5 }, { r: 4, c: 5 }, { r: 5, c: 5 }],
  [{ r: 9, c: 5 }, { r: 10, c: 5 }, { r: 11, c: 5 }],
  [{ r: 3, c: 9 }, { r: 4, c: 9 }, { r: 5, c: 9 }],
  [{ r: 9, c: 9 }, { r: 10, c: 9 }, { r: 11, c: 9 }],
  [{ r: 6, c: 6 }, { r: 7, c: 6 }, { r: 8, c: 6 }],
  [{ r: 6, c: 8 }, { r: 7, c: 8 }, { r: 8, c: 8 }],
  [{ r: 1, c: 4 }, { r: 2, c: 4 }],
  [{ r: 12, c: 4 }, { r: 13, c: 4 }],
  [{ r: 1, c: 10 }, { r: 2, c: 10 }],
  [{ r: 12, c: 10 }, { r: 13, c: 10 }],
  [{ r: 7, c: 3 }, { r: 7, c: 4 }],
  [{ r: 7, c: 10 }, { r: 7, c: 11 }],
]

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function buildMap(): MapData {
  const grid: (string | null)[][] = Array.from({ length: GSIZE }, () => Array(GSIZE).fill(null))
  const walls  = new Set<string>()
  const covers = new Set<string>()

  // Pick 4–7 random wall clusters (keep columns 0–2 and 12–14 clear for spawn)
  const shuffled = shuffle(WALL_CLUSTERS)
  const count = 4 + Math.floor(Math.random() * 4)
  for (let i = 0; i < count && i < shuffled.length; i++) {
    for (const { r, c } of shuffled[i]) {
      if (c > 2 && c < 12) walls.add(`${r},${c}`)
    }
  }

  // Scatter 5–8 cover tiles (not on walls, middle columns only)
  for (let attempt = 0; attempt < 60 && covers.size < 8; attempt++) {
    const r = 1 + Math.floor(Math.random() * 13)
    const c = 3 + Math.floor(Math.random() * 9)
    const key = `${r},${c}`
    if (!walls.has(key)) covers.add(key)
  }

  return { grid, walls, covers }
}

// ── Spawn positions ───────────────────────────────────────────
const PLAYER_SPAWN: { r: number; c: number }[] = [
  { r: 1, c: 0 }, { r: 3, c: 0 }, { r: 5, c: 0 }, { r: 8, c: 0 }, { r: 11, c: 0 },
  { r: 2, c: 1 }, { r: 7, c: 1 }, { r: 12, c: 1 },
]
const ENEMY_SPAWN: { r: number; c: number }[] = [
  { r: 1, c: 14 }, { r: 3, c: 14 }, { r: 5, c: 14 }, { r: 8, c: 14 }, { r: 11, c: 14 },
  { r: 2, c: 13 }, { r: 7, c: 13 }, { r: 12, c: 13 },
]

export function placeUnits(units: Unit[], grid: (string | null)[][]): void {
  let pi = 0, ei = 0
  for (const u of units) {
    if (u.team === 'player') {
      const pos = PLAYER_SPAWN[pi++ % PLAYER_SPAWN.length]
      u.pos = { ...pos }
      grid[pos.r][pos.c] = u.id
    } else {
      const pos = ENEMY_SPAWN[ei++ % ENEMY_SPAWN.length]
      u.pos = { ...pos }
      grid[pos.r][pos.c] = u.id
    }
  }
}

export function moveUnitOnGrid(
  unit: Unit,
  r: number,
  c: number,
  grid: (string | null)[][]
): void {
  grid[unit.pos.r][unit.pos.c] = null
  unit.pos = { r, c }
  grid[r][c] = unit.id
}
