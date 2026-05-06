import type { Difficulty, DifficultyConfig } from './types'

export const DIFF_CONFIG: Record<Difficulty, DifficultyConfig> = {
  easy: {
    hpMult:      0.8,
    dmgMult:     0.75,
    aiDelay:     1200,
    aiSmartness: 0.4,
    rewardMult:  0.7,
    label:       'EASY',
  },
  standard: {
    hpMult:      1.0,
    dmgMult:     1.0,
    aiDelay:     880,
    aiSmartness: 0.7,
    rewardMult:  1.0,
    label:       'STANDARD',
  },
  hard: {
    hpMult:      1.25,
    dmgMult:     1.2,
    aiDelay:     700,
    aiSmartness: 1.0,
    rewardMult:  1.4,
    label:       'HARD',
  },
}

export function getDiffConfig(d: Difficulty): DifficultyConfig {
  return DIFF_CONFIG[d] ?? DIFF_CONFIG.standard
}
