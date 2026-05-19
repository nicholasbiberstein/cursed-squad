// ============================================================
// VIP SYSTEM
// Tracks cumulative spending and unlocks perks at thresholds.
// Future: VIP badge, early event access, bonus rewards.
// ============================================================

export interface VIPTier {
  name:      string
  icon:      string
  minSpend:  number
  color:     string
  perks:     string[]
}

export const VIP_TIERS: VIPTier[] = [
  {
    name: 'RECRUIT',   icon: '⚪', minSpend: 0,
    color: '#555570',
    perks: ['Access to base game'],
  },
  {
    name: 'SOLDIER',   icon: '🟢', minSpend: 5,
    color: '#3cffb4',
    perks: ['+5% coin rewards from battles', 'VIP badge on profile'],
  },
  {
    name: 'VETERAN',   icon: '🔵', minSpend: 20,
    color: '#3c8fff',
    perks: ['+10% coin rewards', '24hr early access to events', 'VIP badge'],
  },
  {
    name: 'ELITE',     icon: '🟣', minSpend: 50,
    color: '#c03cff',
    perks: ['+15% coin rewards', 'Early event access', 'Exclusive VIP pack in shop'],
  },
  {
    name: 'COMMANDER', icon: '🟡', minSpend: 100,
    color: '#ffb800',
    perks: ['+20% coin rewards', '1 free roulette spin per day', 'Early event access', 'Exclusive pack'],
  },
  {
    name: 'LEGEND',    icon: '🔴', minSpend: 250,
    color: '#ff3c3c',
    perks: ['+25% coin rewards', '3 free roulette spins per day', '48hr early event access', 'Exclusive cosmetic title', 'Priority support'],
  },
]

export function getVIPTier(totalSpent: number): VIPTier {
  const reversed = [...VIP_TIERS].reverse()
  return reversed.find(t => totalSpent >= t.minSpend) ?? VIP_TIERS[0]
}

export function getNextVIPTier(totalSpent: number): VIPTier | null {
  const current = getVIPTier(totalSpent)
  const idx     = VIP_TIERS.findIndex(t => t.name === current.name)
  return VIP_TIERS[idx + 1] ?? null
}

export function getVIPCoinBonus(totalSpent: number): number {
  const tier = getVIPTier(totalSpent)
  if (tier.name === 'SOLDIER')   return 1.05
  if (tier.name === 'VETERAN')   return 1.10
  if (tier.name === 'ELITE')     return 1.15
  if (tier.name === 'COMMANDER') return 1.20
  if (tier.name === 'LEGEND')    return 1.25
  return 1.0
}

export function getFreeDailySpins(totalSpent: number): number {
  const tier = getVIPTier(totalSpent)
  if (tier.name === 'COMMANDER') return 1
  if (tier.name === 'LEGEND')    return 3
  return 0
}