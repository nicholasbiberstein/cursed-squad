// ============================================================
// EVENTS DATA
// Login rewards, daily quests, wheel config, mission definitions
// ============================================================

export type TokenType = 'common' | 'rare'

export interface LoginReward {
  day:      number
  icon:     string
  label:    string
  type:     'coins' | 'diamonds' | 'common_token' | 'rare_token' | 'epic_token' | 'legendary_token'
  amount:   number
  special?: boolean
}

export const LOGIN_REWARDS: LoginReward[] = [
  { day:  1, icon: '🪙', label: '50 Coins',                    type: 'coins',           amount: 50   },
  { day:  2, icon: '🪙', label: '100 Coins',                   type: 'coins',           amount: 100  },
  { day:  3, icon: '📦', label: 'Basic Pack Token',            type: 'common_token',    amount: 1,   special: true },
  { day:  4, icon: '🪙', label: '150 Coins',                   type: 'coins',           amount: 150  },
  { day:  5, icon: '🪙', label: '200 Coins',                   type: 'coins',           amount: 200  },
  { day:  6, icon: '💎', label: '2 Diamonds',                  type: 'diamonds',        amount: 2    },
  { day:  7, icon: '🎁', label: 'Rare Pack Token',             type: 'rare_token',      amount: 1,   special: true },
  { day:  8, icon: '🪙', label: '100 Coins',                   type: 'coins',           amount: 100  },
  { day:  9, icon: '🪙', label: '150 Coins',                   type: 'coins',           amount: 150  },
  { day: 10, icon: '💎', label: '3 Diamonds',                  type: 'diamonds',        amount: 3    },
  { day: 11, icon: '🪙', label: '200 Coins',                   type: 'coins',           amount: 200  },
  { day: 12, icon: '🪙', label: '250 Coins',                   type: 'coins',           amount: 250  },
  { day: 13, icon: '💎', label: '4 Diamonds',                  type: 'diamonds',        amount: 4    },
  { day: 14, icon: '💜', label: 'Epic Pack Token',             type: 'epic_token',      amount: 1,   special: true },
  { day: 15, icon: '🪙', label: '200 Coins',                   type: 'coins',           amount: 200  },
  { day: 16, icon: '🪙', label: '250 Coins',                   type: 'coins',           amount: 250  },
  { day: 17, icon: '💎', label: '5 Diamonds',                  type: 'diamonds',        amount: 5    },
  { day: 18, icon: '🪙', label: '300 Coins',                   type: 'coins',           amount: 300  },
  { day: 19, icon: '🪙', label: '350 Coins',                   type: 'coins',           amount: 350  },
  { day: 20, icon: '💎', label: '6 Diamonds',                  type: 'diamonds',        amount: 6    },
  { day: 21, icon: '🎁', label: 'Rare Pack Token',             type: 'rare_token',      amount: 1,   special: true },
  { day: 22, icon: '🪙', label: '300 Coins',                   type: 'coins',           amount: 300  },
  { day: 23, icon: '🪙', label: '400 Coins',                   type: 'coins',           amount: 400  },
  { day: 24, icon: '💎', label: '8 Diamonds',                  type: 'diamonds',        amount: 8    },
  { day: 25, icon: '🪙', label: '500 Coins',                   type: 'coins',           amount: 500  },
  { day: 26, icon: '💜', label: 'Epic Pack Token',             type: 'epic_token',      amount: 1,   special: true },
  { day: 27, icon: '💎', label: '10 Diamonds',                 type: 'diamonds',        amount: 10   },
  { day: 28, icon: '🪙', label: '600 Coins',                   type: 'coins',           amount: 600  },
  { day: 29, icon: '💎', label: '12 Diamonds',                 type: 'diamonds',        amount: 12   },
  { day: 30, icon: '👑', label: 'Legendary Pack + 💎10',       type: 'legendary_token', amount: 1,   special: true },
]

export function getLoginReward(day: number): LoginReward {
  return LOGIN_REWARDS[((day - 1) % 30)] ?? LOGIN_REWARDS[0]
}

export interface QuestDef {
  id:      string
  label:   string
  desc:    string
  icon:    string
  target:  number
  type:    string
}

export const ALL_QUESTS: QuestDef[] = [
  { id: 'login',         label: 'Daily Login',      desc: 'Log in today',                    icon: '📅', target: 1,   type: 'login'         },
  { id: 'win_battles',   label: 'Win 3 Battles',    desc: 'Win any 3 battles',               icon: '⚔',  target: 3,   type: 'win_battle'    },
  { id: 'campaign_wave', label: 'Campaign Wave',     desc: 'Complete a campaign wave',        icon: '🏕', target: 1,   type: 'campaign_wave' },
  { id: 'open_pack',     label: 'Open a Pack',       desc: 'Open any card pack',              icon: '📦', target: 1,   type: 'open_pack'     },
  { id: 'deal_damage',   label: 'Deal 500 Damage',   desc: 'Deal 500+ dmg in one battle',    icon: '💥', target: 500, type: 'damage'        },
  { id: 'use_epic',      label: 'Use Epic Power',    desc: 'Use an epic+ power 3 times',     icon: '💜', target: 3,   type: 'use_epic'      },
  { id: 'ranked_match',  label: 'Play Ranked',       desc: 'Play a ranked match',            icon: '🏆', target: 1,   type: 'ranked_match'  },
  { id: 'upgrade_card',  label: 'Upgrade a Card',    desc: 'Upgrade any card',               icon: '⬆',  target: 1,   type: 'upgrade_card'  },
  { id: 'reroll_curse',  label: 'Reroll a Curse',    desc: 'Reroll a curse in collection',   icon: '🎲', target: 1,   type: 'reroll_curse'  },
  { id: 'send_mission',  label: 'Send on Mission',   desc: 'Send a unit on a mission',       icon: '🗺', target: 1,   type: 'send_mission'  },
  { id: 'hard_battle',   label: 'Hard Mode Win',     desc: 'Win on hard difficulty',         icon: '💀', target: 1,   type: 'hard_win'      },
  { id: 'no_loss_win',   label: 'Perfect Victory',   desc: 'Win without losing a unit',      icon: '✨', target: 1,   type: 'no_loss_win'   },
]

export const QUEST_MILESTONES = [
  { required: 2, reward: { type: 'coins',        amount: 100, icon: '🪙', label: '100 Coins'        } },
  { required: 4, reward: { type: 'common_token', amount: 1,   icon: '📦', label: 'Basic Pack Token' } },
  { required: 6, reward: { type: 'rare_token',   amount: 1,   icon: '🎁', label: 'Rare Pack Token + 💎1', diamonds: 1 } },
]

export function generateDailyQuests(seed: number): QuestDef[] {
  const rng = (n: number) => { let x = Math.sin(n) * 10000; return x - Math.floor(x) }
  const login  = ALL_QUESTS.find(q => q.id === 'login')!
  const others = [...ALL_QUESTS.filter(q => q.id !== 'login')].sort((a, b) => rng(seed + a.id.length) - rng(seed + b.id.length)).slice(0, 5)
  return [login, ...others]
}

export interface WheelSlot {
  label:    string
  icon:     string
  type:     string
  amount:   number
  weight:   number
  color:    string
  special?: boolean
}

export const COMMON_WHEEL: WheelSlot[] = [
  { label: '50 Coins',       icon: '🪙', type: 'coins',           amount: 50,  weight: 25, color: '#ffb800' },
  { label: '150 Coins',      icon: '🪙', type: 'coins',           amount: 150, weight: 20, color: '#ffb800' },
  { label: 'Basic Pack',     icon: '📦', type: 'common_token',    amount: 1,   weight: 20, color: '#aaaaaa' },
  { label: '1 Diamond',      icon: '💎', type: 'diamonds',        amount: 1,   weight: 15, color: '#c03cff' },
  { label: 'Rare Pack',      icon: '🎁', type: 'rare_token',      amount: 1,   weight: 12, color: '#3c8fff' },
  { label: '500 Coins',      icon: '🪙', type: 'coins',           amount: 500, weight: 5,  color: '#ffb800', special: true },
  { label: 'Epic Pack',      icon: '💜', type: 'epic_token',      amount: 1,   weight: 3,  color: '#c03cff', special: true },
]

export const RARE_WHEEL: WheelSlot[] = [
  { label: '300 Coins',      icon: '🪙', type: 'coins',           amount: 300, weight: 20, color: '#ffb800' },
  { label: 'Rare Pack',      icon: '🎁', type: 'rare_token',      amount: 1,   weight: 20, color: '#3c8fff' },
  { label: '3 Diamonds',     icon: '💎', type: 'diamonds',        amount: 3,   weight: 18, color: '#c03cff' },
  { label: 'Epic Pack',      icon: '💜', type: 'epic_token',      amount: 1,   weight: 18, color: '#9b59b6' },
  { label: '10 Diamonds',    icon: '💎', type: 'diamonds',        amount: 10,  weight: 12, color: '#c03cff', special: true },
  { label: 'Legendary Pack', icon: '👑', type: 'legendary_token', amount: 1,   weight: 8,  color: '#ffb800', special: true },
  { label: '2x Next Pack',   icon: '✨', type: 'pack_multiplier', amount: 2,   weight: 4,  color: '#3cffb4', special: true },
]

export function spinWheel(slots: WheelSlot[]): { slot: WheelSlot; index: number } {
  const total = slots.reduce((s, sl) => s + sl.weight, 0)
  let roll    = Math.random() * total
  for (let i = 0; i < slots.length; i++) {
    roll -= slots[i].weight
    if (roll <= 0) return { slot: slots[i], index: i }
  }
  return { slot: slots[0], index: 0 }
}

export interface MissionDef {
  id:        string
  name:      string
  desc:      string
  icon:      string
  duration:  number
  skipCost:  number
  slots:     number
  minRarity: string
  reward:    { coins: number; common_tokens?: number; rare_tokens?: number; diamonds?: number }
  tier:      'quick' | 'standard' | 'difficult' | 'elite' | 'legendary'
}

export const MISSION_POOL: MissionDef[] = [
  { id: 'm_patrol',     name: 'Patrol Route',      desc: 'Scout the perimeter.',          icon: '🗺', duration: 30,   skipCost: 1,  slots: 1, minRarity: 'common',    reward: { coins: 80 },                             tier: 'quick'     },
  { id: 'm_recon',      name: 'Recon Mission',     desc: 'Gather intelligence.',          icon: '🔭', duration: 30,   skipCost: 1,  slots: 1, minRarity: 'common',    reward: { coins: 80 },                             tier: 'quick'     },
  { id: 'm_escort',     name: 'Escort Duty',       desc: 'Protect a valuable target.',    icon: '🛡', duration: 120,  skipCost: 2,  slots: 2, minRarity: 'common',    reward: { coins: 200, common_tokens: 1 },           tier: 'standard'  },
  { id: 'm_ambush',     name: 'Ambush Setup',      desc: 'Prepare a trap.',               icon: '⚡', duration: 120,  skipCost: 2,  slots: 1, minRarity: 'rare',      reward: { coins: 200, common_tokens: 1 },           tier: 'standard'  },
  { id: 'm_supply',     name: 'Supply Run',        desc: 'Gather resources.',             icon: '📦', duration: 120,  skipCost: 2,  slots: 2, minRarity: 'common',    reward: { coins: 220 },                            tier: 'standard'  },
  { id: 'm_raid',       name: 'Enemy Raid',        desc: 'Strike deep into enemy lines.', icon: '⚔', duration: 360,  skipCost: 4,  slots: 2, minRarity: 'rare',      reward: { coins: 400, rare_tokens: 1 },            tier: 'difficult' },
  { id: 'm_sabotage',   name: 'Sabotage Op',       desc: 'Destroy enemy assets.',         icon: '💣', duration: 360,  skipCost: 4,  slots: 2, minRarity: 'rare',      reward: { coins: 400, rare_tokens: 1 },            tier: 'difficult' },
  { id: 'm_extract',    name: 'Extraction',        desc: 'Extract a VIP under fire.',     icon: '🚁', duration: 360,  skipCost: 4,  slots: 3, minRarity: 'common',    reward: { coins: 450 },                            tier: 'difficult' },
  { id: 'm_siege',      name: 'Siege Op',          desc: 'Lay siege to a fortress.',      icon: '🏰', duration: 720,  skipCost: 8,  slots: 3, minRarity: 'epic',      reward: { coins: 800, diamonds: 3 },               tier: 'elite'     },
  { id: 'm_infiltrate', name: 'Deep Infiltration', desc: 'Infiltrate command center.',    icon: '🕵', duration: 720,  skipCost: 8,  slots: 2, minRarity: 'rare',      reward: { coins: 800, rare_tokens: 1, diamonds: 2 }, tier: 'elite'    },
  { id: 'm_war',        name: 'Full Scale War',    desc: 'Lead an all-out assault.',      icon: '👑', duration: 1440, skipCost: 15, slots: 3, minRarity: 'legendary', reward: { coins: 500, diamonds: 5 },               tier: 'legendary' },
  { id: 'm_legend',     name: 'Legend Op',         desc: 'A mission of historic scale.',  icon: '⭐', duration: 1440, skipCost: 15, slots: 3, minRarity: 'epic',      reward: { coins: 400, diamonds: 5 },               tier: 'legendary' },
]

export function generateMissions(count: number): MissionDef[] {
  return [...MISSION_POOL].sort(() => Math.random() - 0.5).slice(0, count)
}

export const TIER_COLORS: Record<string, string> = {
  quick:     'var(--r-common)',
  standard:  'var(--r-rare)',
  difficult: 'var(--r-epic)',
  elite:     'var(--r-legendary)',
  legendary: 'var(--r-mythical)',
}