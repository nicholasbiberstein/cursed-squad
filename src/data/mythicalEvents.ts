// ============================================================
// MYTHICAL EVENT DATA
// Bi-weekly events featuring one mythical power as the prize.
// Two paths: Dungeon (skill) or Roulette (luck/spend)
// ============================================================

import { ALL_POWERS } from './powers'
import type { Power } from './types'

export interface MythicalEvent {
  id:          string
  name:        string
  desc:        string
  powerId:     string      // the featured mythical power
  startDate:   string      // ISO date string
  endDate:     string      // ISO date string
  color:       string
}

// Active events — update this every 2 weeks
export const MYTHICAL_EVENTS: MythicalEvent[] = [
  {
    id:        'event_001',
    name:      'THE CURSED AWAKENING',
    desc:      'A forbidden power stirs. Fight through the dungeon or spin the roulette to claim it.',
    powerId:   'void_strike',     // first mythical power ID
    startDate: '2026-05-19',
    endDate:   '2026-06-02',
    color:     '#ff3c3c',
  },
]

export function getActiveEvent(): MythicalEvent | null {
  const now = new Date().toISOString().split('T')[0]
  return MYTHICAL_EVENTS.find(e => e.startDate <= now && e.endDate >= now) ?? null
}

export function getDaysRemaining(event: MythicalEvent): number {
  const end  = new Date(event.endDate).getTime()
  const now  = Date.now()
  return Math.max(0, Math.ceil((end - now) / 86400000))
}

// ── Roulette prizes ───────────────────────────────────────────
export interface RoulettePrize {
  id:       string
  label:    string
  icon:     string
  type:     string
  amount:   number
  weight:   number
  special?: boolean
}

export const ROULETTE_PRIZES: RoulettePrize[] = [
  { id: 'coins_sm',   label: '100 Coins',       icon: '🪙', type: 'coins',           amount: 100,  weight: 30 },
  { id: 'coins_md',   label: '300 Coins',        icon: '🪙', type: 'coins',           amount: 300,  weight: 15 },
  { id: 'coins_lg',   label: '500 Coins',        icon: '🪙', type: 'coins',           amount: 500,  weight: 5  },
  { id: 'basic_tok',  label: 'Basic Token',      icon: '📦', type: 'common_token',    amount: 1,    weight: 25 },
  { id: 'rare_tok',   label: 'Rare Token',       icon: '🎁', type: 'rare_token',      amount: 1,    weight: 15 },
  { id: 'diamonds',   label: '5 Diamonds',       icon: '💎', type: 'diamonds',        amount: 5,    weight: 7  },
  { id: 'epic_tok',   label: 'Epic Token',       icon: '💜', type: 'epic_token',      amount: 1,    weight: 2.5},
  { id: 'mythical',   label: '☠ MYTHICAL POWER', icon: '☠',  type: 'mythical_power',  amount: 1,    weight: 0.5, special: true },
]

export function spinRoulette(): RoulettePrize {
  const total = ROULETTE_PRIZES.reduce((s, p) => s + p.weight, 0)
  let roll    = Math.random() * total
  for (const prize of ROULETTE_PRIZES) {
    roll -= prize.weight
    if (roll <= 0) return prize
  }
  return ROULETTE_PRIZES[0]
}

// ── Spin packs ────────────────────────────────────────────────
export interface SpinPack {
  id:       string
  name:     string
  price:    string
  priceNum: number   // cents for Stripe
  spins:    number
  tickets:  number
  coins:    number
  diamonds: number
  tokens:   { type: string; amount: number; icon: string }[]
  extras:   string[]
  featured?: boolean
}

export const SPIN_PACKS: SpinPack[] = [
  {
    id: 'spark', name: 'SPARK PACK', price: '$0.99', priceNum: 99,
    spins: 3, tickets: 3, coins: 200, diamonds: 0,
    tokens: [{ type: 'common_token', amount: 1, icon: '📦' }],
    extras: [],
  },
  {
    id: 'surge', name: 'SURGE PACK', price: '$4.99', priceNum: 499,
    spins: 20, tickets: 20, coins: 1000, diamonds: 2,
    tokens: [{ type: 'rare_token', amount: 1, icon: '🎁' }],
    extras: [],
  },
  {
    id: 'storm', name: 'STORM PACK', price: '$9.99', priceNum: 999,
    spins: 45, tickets: 45, coins: 2500, diamonds: 5,
    tokens: [{ type: 'epic_token', amount: 1, icon: '💜' }, { type: 'common_token', amount: 1, icon: '📦' }],
    extras: [],
  },
  {
    id: 'thunder', name: 'THUNDER PACK', price: '$19.99', priceNum: 1999,
    spins: 100, tickets: 100, coins: 6000, diamonds: 15,
    tokens: [{ type: 'epic_token', amount: 1, icon: '💜' }, { type: 'rare_token', amount: 1, icon: '🎁' }],
    extras: [],
    featured: true,
  },
  {
    id: 'legend', name: 'LEGEND PACK', price: '$49.99', priceNum: 4999,
    spins: 250, tickets: 250, coins: 15000, diamonds: 40,
    tokens: [{ type: 'legendary_token', amount: 1, icon: '👑' }, { type: 'epic_token', amount: 1, icon: '💜' }, { type: 'rare_token', amount: 1, icon: '🎁' }],
    extras: [],
  },
  {
    id: 'god', name: 'GOD PACK', price: '$99.99', priceNum: 9999,
    spins: 600, tickets: 600, coins: 40000, diamonds: 100,
    tokens: [{ type: 'legendary_token', amount: 2, icon: '👑' }, { type: 'epic_token', amount: 2, icon: '💜' }],
    extras: ['Full dungeon powerup set', '💎 Bonus diamond chest'],
  },
]

// ── Dungeon levels ────────────────────────────────────────────
export interface DungeonLevel {
  level:       number
  name:        string
  format:      string     // "2v2", "3v3" etc
  playerUnits: number
  enemyUnits:  number
  enemyTier:   string     // min enemy rarity
  desc:        string
  isBoss?:     boolean
}

export const DUNGEON_LEVELS: DungeonLevel[] = [
  { level: 1, name: 'THE OUTSKIRTS',   format: '2v2', playerUnits: 2, enemyUnits: 2, enemyTier: 'common',    desc: 'Weakened sentries guard the entrance.'             },
  { level: 2, name: 'THE GAUNTLET',    format: '3v3', playerUnits: 3, enemyUnits: 3, enemyTier: 'rare',      desc: 'Trained fighters block your path.'                 },
  { level: 3, name: 'THE INNER SANCTUM',format:'4v4', playerUnits: 4, enemyUnits: 4, enemyTier: 'epic',      desc: 'Elite guards with powerful abilities.'             },
  { level: 4, name: 'THE THRONE ROOM', format: '5v5', playerUnits: 5, enemyUnits: 5, enemyTier: 'legendary', desc: 'The cursed champion and their finest warriors.'    },
  { level: 5, name: 'THE BOSS',        format: '5v3', playerUnits: 5, enemyUnits: 3, enemyTier: 'mythical',  desc: 'The bearer of the mythical power. Defeat them.', isBoss: true },
]

// ── Powerups (between levels) ─────────────────────────────────
export interface DungeonPowerup {
  id:    string
  name:  string
  icon:  string
  desc:  string
}

export const DUNGEON_POWERUPS: DungeonPowerup[] = [
  { id: 'full_heal',    name: 'Full Heal',    icon: '❤',  desc: 'Restore one unit to full HP.'                        },
  { id: 'revive',       name: 'Revive',       icon: '💊', desc: 'Bring back one eliminated unit at 50% HP.'           },
  { id: 'power_surge',  name: 'Power Surge',  icon: '⚡', desc: 'One unit deals +50% damage next level.'              },
  { id: 'shield_wall',  name: 'Shield Wall',  icon: '🛡', desc: 'One unit starts next level with a shield active.'    },
]

// ── Ticket store ──────────────────────────────────────────────
export interface TicketItem {
  id:          string
  name:        string
  icon:        string
  cost:        number
  type:        string
  amount:      number
  oneTime?:    boolean
  maxPurchases?: number
  desc:        string
}

export const TICKET_STORE: TicketItem[] = [
  { id: 'coins_500',    name: '500 Coins',         icon: '🪙', cost: 10,  type: 'coins',           amount: 500,  desc: 'Quick coin exchange.'              },
  { id: 'basic_tok',    name: 'Basic Pack Token',  icon: '📦', cost: 15,  type: 'common_token',    amount: 1,    desc: 'Open a basic card pack.'           },
  { id: 'rare_tok',     name: 'Rare Pack Token',   icon: '🎁', cost: 30,  type: 'rare_token',      amount: 1,    desc: 'Open a rare card pack.'            },
  { id: 'diamonds_5',   name: '5 Diamonds',        icon: '💎', cost: 50,  type: 'diamonds',        amount: 5,    desc: 'Convert tickets to diamonds.'      },
  { id: 'epic_tok',     name: 'Epic Pack Token',   icon: '💜', cost: 60,  type: 'epic_token',      amount: 1,    desc: 'Open an epic card pack.'           },
  { id: 'diamonds_20',  name: '20 Diamonds',       icon: '💎', cost: 180, type: 'diamonds',        amount: 20,   desc: 'Premium diamond exchange.'         },
  { id: 'legend_tok',   name: 'Legendary Token',   icon: '👑', cost: 120, type: 'legendary_token', amount: 1,    desc: 'Open a legendary card pack.'       },
  { id: 'mythical_1st', name: '☠ MYTHICAL POWER',  icon: '☠',  cost: 200, type: 'mythical_power',  amount: 1,    oneTime: true,    desc: 'Claim the event mythical power. One time only per event.' },
  { id: 'mythical_dup', name: '☠ MYTHICAL DUPE',   icon: '☠',  cost: 500, type: 'mythical_dupe',   amount: 1,    desc: 'Get a duplicate mythical for upgrading. Repeatable.'      },
]