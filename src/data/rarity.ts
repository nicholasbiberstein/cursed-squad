import type { Rarity, RarityConfig, SynergyTag } from './types'

// ── Rarity definitions ───────────────────────────────────────
export const RARITY: Record<Rarity, RarityConfig> = {
  common: {
    label:      'COMMON',
    color:      'var(--r-common)',
    coinCost:   50,
    diaCost:    0,
    rerollCost: 1,
    refineCost: 40,
  },
  rare: {
    label:      'RARE',
    color:      'var(--r-rare)',
    coinCost:   120,
    diaCost:    0,
    rerollCost: 2,
    refineCost: 80,
  },
  epic: {
    label:      'EPIC',
    color:      'var(--r-epic)',
    coinCost:   220,
    diaCost:    0,
    rerollCost: 3,
    refineCost: 140,
  },
  legendary: {
    label:      'LEGENDARY',
    color:      'var(--r-legendary)',
    coinCost:   0,
    diaCost:    12,
    rerollCost: 5,
    refineCost: 200,
  },
  mythical: {
    label:      'MYTHICAL',
    color:      'var(--r-mythical)',
    coinCost:   0,
    diaCost:    0,
    rerollCost: 8,
    refineCost: 999,
    eventOnly:  true,
  },
}

export function rarColor(r: Rarity): string {
  return RARITY[r]?.color ?? 'var(--muted)'
}
export function rarLabel(r: Rarity): string {
  return RARITY[r]?.label ?? r.toUpperCase()
}

// ── Synergy tag display metadata ─────────────────────────────
export const SYN_TAGS: Record<SynergyTag, { label: string; cls: string }> = {
  'high-risk':  { label: '🔥 HIGH RISK',  cls: 'high-risk'  },
  'positioning':{ label: '🧭 POSITIONING',cls: 'positioning' },
  'unstable':   { label: '⚠ UNSTABLE',   cls: 'unstable'   },
  'defensive':  { label: '🛡 DEFENSIVE',  cls: 'defensive'  },
  'aggressive': { label: '⚡ AGGRESSIVE', cls: 'aggressive' },
  'utility':    { label: '🔧 UTILITY',    cls: 'utility'    },
  'stealth':    { label: '👻 STEALTH',    cls: 'stealth'    },
}

export const POWER_CATS = ['melee', 'ranged', 'reinforcing', 'control', 'perception', 'mobility'] as const
export const CURSE_CATS = ['physical', 'mental', 'temporal', 'visibility', 'instability'] as const
