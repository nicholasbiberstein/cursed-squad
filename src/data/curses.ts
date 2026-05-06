import type { Curse } from './types'

// ============================================================
// ALL CURSES
// Pure data — no logic, no UI imports.
// Migrated from v0.65 HTML prototype.
// ============================================================
export const ALL_CURSES: Curse[] = [

  // ── PHYSICAL ────────────────────────────────────────────
  { id: 'health_drain',  rarity: 'common',    cat: 'physical',    icon: '🩸', name: 'Health Drain',    desc: 'Lose 8 HP at the start of each of your turns.',            synergy: ['high-risk'] },
  { id: 'glass_body',    rarity: 'common',    cat: 'physical',    icon: '💎', name: 'Glass Body',      desc: 'Take 50% extra damage from all sources.',                  synergy: ['high-risk', 'aggressive'] },
  { id: 'backfire',      rarity: 'rare',      cat: 'physical',    icon: '💥', name: 'Backfire',         desc: 'Take 10 self-damage every time you use this ability.',      synergy: ['high-risk'] },
  { id: 'decay',         rarity: 'epic',      cat: 'physical',    icon: '☠',  name: 'Decay',            desc: 'Maximum HP decreases by 5 every turn.',                    synergy: ['high-risk', 'aggressive'] },
  { id: 'berserker',     rarity: 'legendary', cat: 'physical',    icon: '😤', name: 'Berserker',        desc: 'Deal +75% damage but lose 15 HP each ability use.',         synergy: ['high-risk', 'aggressive'] },
  { id: 'soulbound',     rarity: 'legendary', cat: 'physical',    icon: '🔮', name: 'Soul Bound',       desc: 'On death: deal 50 damage to ALL enemies still alive.',      synergy: ['high-risk'] },
  { id: 'brittle',       rarity: 'common',    cat: 'physical',    icon: '🦴', name: 'Brittle',          desc: 'Take +25% damage from physical attacks.',                  synergy: ['high-risk'] },
  { id: 'blood_cost',    rarity: 'rare',      cat: 'physical',    icon: '💉', name: 'Blood Cost',       desc: 'Spend 12 HP to activate this ability instead of using it normally.', synergy: ['high-risk'] },

  // ── MENTAL ──────────────────────────────────────────────
  { id: 'unstable_aim',  rarity: 'common',    cat: 'mental',      icon: '🎲', name: 'Unstable Aim',    desc: '25% chance your ability misses completely.',               synergy: ['unstable'] },
  { id: 'fragile_mind',  rarity: 'rare',      cat: 'mental',      icon: '🧠', name: 'Fragile Mind',    desc: 'Start battle Confused — 30% chance to act randomly.',      synergy: ['unstable'] },
  { id: 'unstable_core', rarity: 'epic',      cat: 'mental',      icon: '🌋', name: 'Unstable Core',   desc: 'Gain a random status effect each turn start.',             synergy: ['unstable'] },
  { id: 'adrenal_crash', rarity: 'epic',      cat: 'mental',      icon: '📉', name: 'Adrenal Crash',   desc: 'Empowered turn 1, then Stunned on turn 2.',                synergy: ['aggressive', 'high-risk'] },
  { id: 'paranoia',      rarity: 'rare',      cat: 'mental',      icon: '👁', name: 'Paranoia',        desc: '30% chance to waste this action targeting a random tile.',  synergy: ['unstable'] },
  { id: 'overconfident', rarity: 'common',    cat: 'mental',      icon: '🤡', name: 'Overconfident',   desc: 'Deal +20% damage but have a 15% self-hit chance.',          synergy: ['high-risk', 'aggressive'] },

  // ── TEMPORAL ────────────────────────────────────────────
  { id: 'stunned_after',  rarity: 'common',   cat: 'temporal',    icon: '😵', name: 'Stunned After',   desc: 'Skip your next turn after using this ability.',            synergy: ['high-risk', 'aggressive'] },
  { id: 'delayed_action', rarity: 'rare',     cat: 'temporal',    icon: '⏳', name: 'Delayed Action',  desc: 'Ability fires next turn instead of this one.',             synergy: ['positioning', 'utility'] },
  { id: 'energy_burnout', rarity: 'rare',     cat: 'temporal',    icon: '🔋', name: 'Energy Burnout',  desc: 'Every 2nd turn is automatically skipped.',                 synergy: ['unstable'] },
  { id: 'slow_react',     rarity: 'common',   cat: 'temporal',    icon: '🐢', name: 'Slow Reaction',   desc: 'Speed locked to minimum — always act last.',               synergy: ['defensive', 'positioning'] },
  { id: 'delayed_reflex', rarity: 'rare',     cat: 'temporal',    icon: '🦥', name: 'Delayed Reflex',  desc: 'Permanently Slowed — always acts near the end.',           synergy: ['defensive', 'positioning'] },
  { id: 'exhaustion',     rarity: 'epic',     cat: 'temporal',    icon: '😴', name: 'Exhaustion',      desc: 'Each time you act, speed decreases by 1 (min 1).',         synergy: ['high-risk', 'utility'] },

  // ── VISIBILITY ──────────────────────────────────────────
  { id: 'loud_movement',  rarity: 'rare',     cat: 'visibility',  icon: '📢', name: 'Loud Movement',   desc: 'Moving reveals your position and breaks stealth.',         synergy: ['positioning', 'stealth'] },
  { id: 'signal_leak',    rarity: 'rare',     cat: 'visibility',  icon: '📡', name: 'Signal Leak',     desc: 'Every 2nd turn your position is auto-revealed.',           synergy: ['unstable', 'stealth'] },
  { id: 'blind',          rarity: 'common',   cat: 'visibility',  icon: '🙈', name: 'Blind',           desc: 'Vision range reduced to 2 tiles.',                         synergy: ['positioning'] },
  { id: 'ghost_body',     rarity: 'epic',     cat: 'visibility',  icon: '👻', name: 'Ghost Body',      desc: 'Invisible always — but cannot use this ability.',          synergy: ['stealth', 'defensive'] },
  { id: 'bright_aura',    rarity: 'common',   cat: 'visibility',  icon: '💡', name: 'Bright Aura',     desc: 'Always revealed — enemies always know your position.',     synergy: ['aggressive'] },
  { id: 'blinking',       rarity: 'rare',     cat: 'visibility',  icon: '👁', name: 'Blinking',        desc: 'Randomly reveal or conceal yourself each turn start.',     synergy: ['unstable', 'stealth'] },

  // ── INSTABILITY ─────────────────────────────────────────
  { id: 'random_move',    rarity: 'common',   cat: 'instability', icon: '🌀', name: 'Random Move',     desc: 'Stumble 1 random tile at your turn start.',                synergy: ['unstable'] },
  { id: 'locked_pos',     rarity: 'rare',     cat: 'instability', icon: '⚓', name: 'Locked Position', desc: 'Cannot move at all — ever.',                               synergy: ['positioning', 'defensive'] },
  { id: 'toxic_body',     rarity: 'epic',     cat: 'instability', icon: '☣', name: 'Toxic Body',      desc: 'Permanently Poisoned — lose 8 HP per turn.',               synergy: ['high-risk'] },
  { id: 'corrupt_heal',   rarity: 'rare',     cat: 'instability', icon: '🚫', name: 'Corrupt Healing', desc: 'Any healing you receive converts to Poison instead.',      synergy: ['high-risk', 'unstable'] },
  { id: 'combustible',    rarity: 'epic',     cat: 'instability', icon: '🧨', name: 'Combustible',     desc: '+75% fire damage taken, but your fire attacks deal +50%.', synergy: ['high-risk', 'aggressive'] },
  { id: 'mirror_curse',   rarity: 'legendary',cat: 'instability', icon: '🪞', name: 'Mirror Curse',    desc: 'When you damage a target, you also take 30% of that damage.', synergy: ['high-risk'] },
]

export function getCurseById(id: string): Curse | undefined {
  return ALL_CURSES.find(c => c.id === id)
}
