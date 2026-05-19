// ============================================================
// PACK SYSTEM
// Defines pack types, rarity weights, and upgrade costs.
// Mythical cards are NEVER available in packs — events only.
// ============================================================

import type { Rarity } from './types'
import { ALL_POWERS } from './powers'

export type PackId = 'basic' | 'rare' | 'epic' | 'legendary'
export type Currency = 'coins' | 'diamonds'

export interface PackDef {
  id:       PackId
  name:     string
  icon:     string
  cost:     number
  currency: Currency
  cards:    number
  weights:  Record<Rarity, number>
  desc:     string
  color:    string
}

export const PACK_DEFS: PackDef[] = [
  {
    id: 'basic', name: 'BASIC PACK', icon: '📦', cost: 150, currency: 'coins', cards: 3,
    weights: { common: 70, rare: 25, epic: 5, legendary: 0, mythical: 0 },
    desc: 'A standard pack. Mostly commons with a chance at rare.',
    color: 'var(--r-common)',
  },
  {
    id: 'rare', name: 'RARE PACK', icon: '🎁', cost: 400, currency: 'coins', cards: 3,
    weights: { common: 40, rare: 45, epic: 15, legendary: 0, mythical: 0 },
    desc: 'Higher chance of rare cards. Occasional epic.',
    color: 'var(--r-rare)',
  },
  {
    id: 'epic', name: 'EPIC PACK', icon: '💜', cost: 10, currency: 'diamonds', cards: 3,
    weights: { common: 10, rare: 40, epic: 40, legendary: 10, mythical: 0 },
    desc: 'Guaranteed epic or better. Real chance at legendary.',
    color: 'var(--r-epic)',
  },
  {
    id: 'legendary', name: 'LEGENDARY PACK', icon: '👑', cost: 50, currency: 'diamonds', cards: 5,
    weights: { common: 0, rare: 10, epic: 35, legendary: 55, mythical: 0 },
    desc: 'Premium pack. Mostly legendary cards. 5 cards per pack.',
    color: 'var(--r-legendary)',
  },
]

// ── Upgrade table ─────────────────────────────────────────────
export interface UpgradeTier {
  level: number
  dupes: number
  coins: number
}

export const UPGRADE_TIERS: UpgradeTier[] = [
  { level: 2,  dupes: 2,   coins: 50   },
  { level: 3,  dupes: 4,   coins: 100  },
  { level: 4,  dupes: 8,   coins: 200  },
  { level: 5,  dupes: 15,  coins: 400  },
  { level: 6,  dupes: 25,  coins: 800  },
  { level: 7,  dupes: 40,  coins: 1500 },
  { level: 8,  dupes: 60,  coins: 2500 },
  { level: 9,  dupes: 90,  coins: 4000 },
  { level: 10, dupes: 130, coins: 6000 },
]

export const MAX_LEVEL = 10

export function getUpgradeTier(level: number): UpgradeTier | null {
  return UPGRADE_TIERS.find(t => t.level === level + 1) ?? null
}

// ── Rarity weights ────────────────────────────────────────────
const RARITY_WEIGHT: Record<Rarity, number> = {
  common:    1,
  rare:      2,
  epic:      3,
  legendary: 5,
  mythical:  10,
}

// ── Power score ───────────────────────────────────────────────
export function calcPowerScore(forged: Array<{ powerId: string; level?: number }>): number {
  return forged.reduce((total, entry) => {
    const power  = ALL_POWERS.find(p => p.id === entry.powerId)
    const weight = RARITY_WEIGHT[power?.rarity ?? 'common']
    const level  = entry.level ?? 1
    return total + (level * weight)
  }, 0)
}

// ── Open a pack — returns array of power IDs with rarities ────
export function openPack(packId: PackId): Array<{ powerId: string; rarity: Rarity; isNew: boolean }> {
  const pack     = PACK_DEFS.find(p => p.id === packId)!
  const results: Array<{ powerId: string; rarity: Rarity; isNew: boolean }> = []

  for (let i = 0; i < pack.cards; i++) {
    const rarity  = rollRarity(pack.weights)
    const pool    = ALL_POWERS.filter(p => p.rarity === rarity && p.rarity !== 'mythical')
    const power   = pool[Math.floor(Math.random() * pool.length)]
    if (power) results.push({ powerId: power.id, rarity, isNew: false })
  }

  return results
}

function rollRarity(weights: Record<Rarity, number>): Rarity {
  const total = Object.values(weights).reduce((a, b) => a + b, 0)
  let roll    = Math.random() * total
  for (const [rarity, weight] of Object.entries(weights)) {
    roll -= weight
    if (roll <= 0) return rarity as Rarity
  }
  return 'common'
}

// ── Level bonus multiplier ────────────────────────────────────
export function getLevelBonus(level: number): number {
  return 1 + ((level - 1) * 0.05)  // +5% per level, Level 10 = 1.45x
}