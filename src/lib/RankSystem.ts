// ============================================================
// RANK SYSTEM
// MMR calculation, tier assignment, division tracking.
// Matches Clash Royale style tiered progression.
// ============================================================

export interface RankInfo {
  tier:      string
  division:  number  // 1, 2, 3 (1 = highest in tier)
  label:     string  // e.g. "Diamond II"
  icon:      string
  mmr:       number
  nextMMR:   number  // MMR needed for next tier
  color:     string
}

export const TIERS = [
  { name: 'UNRANKED', icon: '❓', min: -1,   max: -1,   color: '#555570' },
  { name: 'BRONZE',   icon: '🥉', min: 0,    max: 499,  color: '#cd7f32' },
  { name: 'SILVER',   icon: '🥈', min: 500,  max: 999,  color: '#aaaaaa' },
  { name: 'GOLD',     icon: '🥇', min: 1000, max: 1499, color: '#ffb800' },
  { name: 'PLATINUM', icon: '💎', min: 1500, max: 1999, color: '#3cffb4' },
  { name: 'DIAMOND',  icon: '💠', min: 2000, max: 2999, color: '#3c8fff' },
  { name: 'MASTER',   icon: '⚔',  min: 3000, max: 3999, color: '#c03cff' },
  { name: 'LEGEND',   icon: '👑', min: 4000, max: 99999, color: '#ff3c3c' },
]

export function getRankInfo(mmr: number, placementDone: boolean): RankInfo {
  if (!placementDone) {
    return { tier: 'UNRANKED', division: 0, label: 'PLACEMENT', icon: '❓', mmr, nextMMR: 0, color: '#555570' }
  }

  const tier = TIERS.find(t => mmr >= t.min && mmr <= t.max) ?? TIERS[TIERS.length - 1]

  if (tier.name === 'LEGEND') {
    return { tier: 'LEGEND', division: 1, label: 'LEGEND', icon: '👑', mmr, nextMMR: 99999, color: tier.color }
  }

  // Divide each tier into 3 divisions
  const range = tier.max - tier.min
  const divSize = Math.floor(range / 3)
  const posInTier = mmr - tier.min
  const division = posInTier < divSize ? 3 : posInTier < divSize * 2 ? 2 : 1

  const nextTierIdx = TIERS.findIndex(t => t.name === tier.name) + 1
  const nextTier = TIERS[nextTierIdx]

  return {
    tier:     tier.name,
    division,
    label:    tier.name === 'BRONZE' || tier.name === 'SILVER' || tier.name === 'GOLD'
                ? `${tier.name} ${['III','II','I'][division - 1]}`
                : `${tier.name} ${['III','II','I'][division - 1]}`,
    icon:     tier.icon,
    mmr,
    nextMMR:  nextTier?.min ?? 99999,
    color:    tier.color,
  }
}

// ── MMR calculation ───────────────────────────────────────────
export function calcMMRChange(
  winnerMMR: number,
  loserMMR:  number,
  won:       boolean
): number {
  const diff = loserMMR - winnerMMR  // positive = underdog win
  if (won) {
    if (diff > 200)  return 30  // beat higher ranked
    if (diff > -200) return 20  // beat similar rank
    return 10                    // beat lower ranked
  } else {
    return -15  // loss always -15
  }
}

// ── Match rewards ─────────────────────────────────────────────
export function getMatchRewards(won: boolean, isPlacement: boolean): { coins: number; diamonds: number } {
  if (isPlacement) return { coins: won ? 80 : 30, diamonds: 0 }
  return {
    coins:    won ? 60 : 20,
    diamonds: won ? 1  : 0,
  }
}