import type { ForgedEntry, Power, Curse } from '@data/types'
import { ALL_CURSES } from '@data/curses'
import { RARITY } from '@data/rarity'
import { save } from './SaveManager'

// ============================================================
// FORGE SYSTEM
// Handles buying, forging, rerolling, and refining cards.
// Migrated from v0.65 HTML prototype.
// ============================================================

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Generate 3 curse options for a forge, matching rarity where possible. */
export function generateCurseOptions(power: Power): Curse[] {
  const usedIds = save.forged.map(f => f.curseId)
  const sameRar = ALL_CURSES.filter(c => c.rarity === power.rarity && !usedIds.includes(c.id))
  const fallback = ALL_CURSES.filter(c => !usedIds.includes(c.id))

  let options = shuffle(sameRar.length >= 3 ? sameRar : fallback).slice(0, 3)
  // Pad to 3 if needed
  while (options.length < 3) {
    const extra = fallback.find(c => !options.includes(c))
    if (extra) options.push(extra); else break
  }
  return options.slice(0, 3)
}

/** Buy a power and present curse options. Returns the curse pool. */
export function buyPower(power: Power): { cursePool: Curse[] } | { error: string } {
  const rar = RARITY[power.rarity]
  const isDia = rar.diaCost > 0

  if (isDia) {
    if (save.diamonds < rar.diaCost) return { error: `Need 💎 ${rar.diaCost} diamonds!` }
    save.diamonds -= rar.diaCost
  } else {
    if (save.coins < rar.coinCost) return { error: `Need 🪙 ${rar.coinCost} coins!` }
    save.coins -= rar.coinCost
  }
  save.persistCoins()

  return { cursePool: generateCurseOptions(power) }
}

/** Confirm a forge — add the forged entry to the collection. */
export function confirmForge(powerId: string, curseId: string): void {
  save.forged.push({ powerId, curseId, rerollCount: 0, refinements: [] })
  save.persistForged()
}

/** Get reroll cost for a forged entry (base + per-reroll increment). */
export function rerollCost(entry: ForgedEntry, power: Power): number {
  return (RARITY[power.rarity]?.rerollCost ?? 2) + (entry.rerollCount ?? 0)
}

/** Reroll a curse — deducts diamonds, returns new curse pool or error. */
export function rerollCurse(
  power: Power,
  entry: ForgedEntry
): { cursePoll: Curse[] } | { error: string } {
  const cost = rerollCost(entry, power)
  if (save.diamonds < cost) return { error: `Need 💎 ${cost} diamonds!` }
  save.diamonds -= cost
  save.persistCoins()
  entry.rerollCount = (entry.rerollCount ?? 0) + 1
  return { cursePoll: generateCurseOptions(power) }
}

/** Confirm a reroll — swaps the old curse for the new one. */
export function confirmReroll(entry: ForgedEntry, newCurseId: string): void {
  entry.curseId = newCurseId
  save.persistForged()
}

/** Refine cost for a forged entry. */
export function refineCost(power: Power): number {
  return RARITY[power.rarity]?.refineCost ?? 40
}

/** Apply a refinement to an entry — deducts coins, returns error or success. */
export function applyRefinement(
  power: Power,
  entry: ForgedEntry,
  refId: string
): { success: true } | { error: string } {
  if ((entry.refinements ?? []).length >= 2) return { error: 'Max 2 refinements per card.' }
  const cost = refineCost(power)
  if (save.coins < cost) return { error: `Need 🪙 ${cost} coins!` }
  save.coins -= cost
  if (!entry.refinements) entry.refinements = []
  entry.refinements.push(refId)
  save.persistCoins()
  save.persistForged()
  return { success: true }
}
