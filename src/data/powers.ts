import type { Power } from './types'

// ============================================================
// ALL POWERS
// Pure data — no logic, no UI imports.
// Migrated from v0.65 HTML prototype.
// ============================================================
export const ALL_POWERS: Power[] = [

  // ── COMMON ──────────────────────────────────────────────
  { id: 'strike',         rarity: 'common',    cat: 'melee',       type: 'damage',   range: 1,  damage: 32, icon: '⚔',  name: 'Strike',          desc: 'Solid melee damage.' },
  { id: 'minor_heal',     rarity: 'common',    cat: 'reinforcing', type: 'heal',      range: 3,  heal:   35, icon: '💊', name: 'Minor Heal',       desc: 'Restore HP to self or adjacent ally.' },
  { id: 'short_dash',     rarity: 'common',    cat: 'mobility',    type: 'dash',      range: 1,  damage: 20, icon: '💨', name: 'Short Dash',        desc: 'Move 2 extra tiles then strike adjacent.' },
  { id: 'shove',          rarity: 'common',    cat: 'control',     type: 'push',      range: 1,  damage: 12, icon: '👊', name: 'Shove',             desc: 'Push enemy back 2 tiles and deal light damage.' },
  { id: 'scout_ping',     rarity: 'common',    cat: 'perception',  type: 'scan',      range: 4,              icon: '📡', name: 'Scout Ping',        desc: 'Reveal enemies in a small radius for 2 turns.' },
  { id: 'fortify_common', rarity: 'common',    cat: 'reinforcing', type: 'shield',    range: 0,              icon: '🛡', name: 'Fortify',           desc: 'Raise a shield — halve incoming damage this turn.' },
  { id: 'cheap_shot',     rarity: 'common',    cat: 'melee',       type: 'damage',    range: 1,  damage: 22, icon: '🗡', name: 'Cheap Shot',       desc: 'Quick melee hit. Good with aggressive curses.' },
  { id: 'flare',          rarity: 'common',    cat: 'perception',  type: 'reveal',    range: 5,              icon: '🔦', name: 'Flare',             desc: 'Mark an enemy — visible and takes +25% damage.' },
  { id: 'trip',           rarity: 'common',    cat: 'control',     type: 'slow',      range: 2,              icon: '🦿', name: 'Trip',              desc: 'Slow a target for 2 turns.' },
  { id: 'patch_up',       rarity: 'common',    cat: 'reinforcing', type: 'cleanse',   range: 2,              icon: '🩹', name: 'Patch Up',          desc: 'Remove all debuffs from self or ally within 2.' },

  // ── RARE ────────────────────────────────────────────────
  { id: 'heavy_blow',     rarity: 'rare',      cat: 'melee',       type: 'damage',    range: 1,  damage: 62, icon: '💥', name: 'Heavy Blow',        desc: 'Massive melee hit. High risk, high reward.' },
  { id: 'sniper_shot',    rarity: 'rare',      cat: 'ranged',      type: 'line',      range: 14, damage: 48, icon: '🎯', name: 'Sniper Shot',       desc: 'Long-range shot along a line. Walls block LoS.' },
  { id: 'piercing_shot',  rarity: 'rare',      cat: 'ranged',      type: 'damage',    range: 4,  damage: 36, icon: '🏹', name: 'Piercing Shot',     desc: 'Shot ignores cover bonus. Medium range.' },
  { id: 'mark_target',    rarity: 'rare',      cat: 'control',     type: 'mark',      range: 6,              icon: '🔴', name: 'Mark Target',       desc: 'Target takes +50% damage for 2 turns.' },
  { id: 'area_scan_r',    rarity: 'rare',      cat: 'perception',  type: 'scan',      range: 5,              icon: '📶', name: 'Area Scan',         desc: 'Reveal all enemies in a wide radius for 3 turns.' },
  { id: 'leech_attack',   rarity: 'rare',      cat: 'melee',       type: 'leech',     range: 1,  damage: 30, icon: '🩸', name: 'Leech Attack',      desc: 'Deal damage and heal yourself for half.' },
  { id: 'time_delay',     rarity: 'rare',      cat: 'control',     type: 'slow',      range: 5,              icon: '⏱', name: 'Time Delay',        desc: 'Force target to act last for 2 turns.' },
  { id: 'smoke_screen',   rarity: 'rare',      cat: 'mobility',    type: 'stealth',   range: 0,              icon: '💨', name: 'Smoke Screen',       desc: 'Become invisible for 2 turns. Breaks on attack.' },
  { id: 'disarm',         rarity: 'rare',      cat: 'control',     type: 'damage',    range: 2,  damage: 18, icon: '🫳', name: 'Disarm',            desc: 'Weaken target — reduces their damage for 2 turns.', applyS: ['weakened', 2, 0] },
  { id: 'rally',          rarity: 'rare',      cat: 'reinforcing', type: 'selfbuff',  range: 0,              icon: '💪', name: 'Rally',             desc: 'Grant Empowered for 2 turns.', applyS: ['selfempower', 2, 0] },
  { id: 'ground_slam',    rarity: 'rare',      cat: 'melee',       type: 'aoe',       range: 2,  damage: 18, icon: '🌍', name: 'Ground Slam',       desc: 'Slam the ground — hits adjacent tiles in a cross.' },
  { id: 'poison_dart',    rarity: 'rare',      cat: 'ranged',      type: 'damage',    range: 4,  damage: 16, icon: '🎯', name: 'Poison Dart',       desc: 'Ranged shot that poisons for 3 turns.', applyS: ['poison', 3, 6] },
  { id: 'chain_pull',     rarity: 'rare',      cat: 'control',     type: 'push',      range: 3,  damage: 10, icon: '🔗', name: 'Chain Pull',        desc: 'Pull an enemy 2 tiles toward you.' },

  // ── EPIC ────────────────────────────────────────────────
  { id: 'aoe_blast',      rarity: 'epic',      cat: 'ranged',      type: 'aoe',       range: 4,  damage: 24, icon: '💣', name: 'AOE Blast',         desc: 'Explosion hits all units in 3×3 area.' },
  { id: 'chain_lightning',rarity: 'epic',      cat: 'ranged',      type: 'aoe',       range: 5,  damage: 20, icon: '⚡', name: 'Chain Lightning',   desc: 'Arcs between enemies — hits 3×3 area.', applyS: ['slowed', 1, 0] },
  { id: 'time_lock',      rarity: 'epic',      cat: 'control',     type: 'aoe',       range: 3,  damage: 8,  icon: '⏸', name: 'Time Lock',          desc: 'AOE stun all enemies in radius for 2 turns.', applyS: ['stunned', 2, 0] },
  { id: 'shadow_ambush',  rarity: 'epic',      cat: 'mobility',    type: 'stealth',   range: 0,              icon: '🌑', name: 'Shadow Ambush',     desc: 'Invisible 3 turns. +50% ambush damage.' },
  { id: 'corrupt_blow',   rarity: 'epic',      cat: 'melee',       type: 'damage',    range: 1,  damage: 28, icon: '💀', name: 'Corrupt Blow',      desc: 'Weakens target — reduces their damage for 2 turns.', applyS: ['weakened', 2, 0] },
  { id: 'toxic_strike',   rarity: 'epic',      cat: 'melee',       type: 'damage',    range: 1,  damage: 20, icon: '🧪', name: 'Toxic Strike',      desc: 'Melee hit that poisons for 2 turns.', applyS: ['poison', 2, 8] },
  { id: 'double_action',  rarity: 'epic',      cat: 'mobility',    type: 'double',    range: 0,              icon: '⚡', name: 'Double Action',     desc: 'Refresh move and ability this turn.' },
  { id: 'warcry',         rarity: 'epic',      cat: 'reinforcing', type: 'aoe_buff',  range: 0,              icon: '📣', name: 'War Cry',           desc: 'All allies: Haste + Empowered this turn.' },
  { id: 'burning_wave',   rarity: 'epic',      cat: 'ranged',      type: 'aoe',       range: 4,  damage: 16, icon: '🔥', name: 'Burning Wave',      desc: 'Fire AOE that burns all units in area.', applyS: ['burn', 2, 0] },
  { id: 'phase_shift',    rarity: 'epic',      cat: 'mobility',    type: 'teleport',  range: 0,              icon: '🌀', name: 'Phase Shift',       desc: 'Teleport to any visible tile within 5 range.' },
  { id: 'nullify',        rarity: 'epic',      cat: 'control',     type: 'cleanse',   range: 4,              icon: '✨', name: 'Nullify',           desc: 'Strip all buffs from a target enemy.' },
  { id: 'shockwave',      rarity: 'epic',      cat: 'control',     type: 'push',      range: 2,  damage: 20, icon: '💥', name: 'Shockwave',         desc: 'Knockback all adjacent enemies 2 tiles.' },

  // ── LEGENDARY ───────────────────────────────────────────
  { id: 'reality_break',  rarity: 'legendary', cat: 'ranged',      type: 'aoe',       range: 4,  damage: 32, icon: '🌀', name: 'Reality Break',     desc: 'Mass AOE chaos — hits all enemies in 5×5.', applyS: ['confused', 2, 0] },
  { id: 'perfect_focus',  rarity: 'legendary', cat: 'ranged',      type: 'line',      range: 14, damage: 80, icon: '🎯', name: 'Perfect Focus',     desc: 'Guaranteed critical hit — cannot miss. Massive damage.' },
  { id: 'soul_drain',     rarity: 'legendary', cat: 'ranged',      type: 'leech',     range: 3,  damage: 42, icon: '✨', name: 'Soul Drain',        desc: 'Long-range drain — steal HP from a distant foe.' },
  { id: 'rewind',         rarity: 'legendary', cat: 'reinforcing', type: 'selfbuff',  range: 0,              icon: '⏪', name: 'Rewind',            desc: 'Reset HP to what it was at the start of this turn.' },
  { id: 'shadow_step',    rarity: 'legendary', cat: 'mobility',    type: 'teleport',  range: 0,              icon: '🌑', name: 'Shadow Step',       desc: 'Teleport up to 6 tiles within fog areas only.' },
  { id: 'death_mark',     rarity: 'legendary', cat: 'control',     type: 'mark',      range: 8,              icon: '💀', name: 'Death Mark',        desc: 'Target takes +75% damage for 3 turns. Extreme range.' },
  { id: 'void_pull',      rarity: 'legendary', cat: 'control',     type: 'aoe',       range: 5,  damage: 14, icon: '⬛', name: 'Void Pull',         desc: 'Drag all enemies toward a target point.' },

  // ── MYTHICAL (event-only) ────────────────────────────────
  { id: 'paradox_engine', rarity: 'mythical',  cat: 'control',     type: 'aoe',       range: 5,  damage: 15, icon: '♾', name: 'Paradox Engine',   desc: 'EVENT: Extra turns — then squad skips next.', applyS: ['stunned', 1, 0] },
  { id: 'entropy_field',  rarity: 'mythical',  cat: 'perception',  type: 'aoe_buff',  range: 0,              icon: '🌋', name: 'Entropy Field',     desc: 'EVENT: Random status applied to every unit.' },
]

export function getPowerById(id: string): Power | undefined {
  return ALL_POWERS.find(p => p.id === id)
}
