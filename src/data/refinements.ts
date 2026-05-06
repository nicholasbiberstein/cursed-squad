import type { AbilityType, Power, Refinement } from './types'

// ============================================================
// REFINEMENT POOL
// Maps ability type → available refinements (max 2 per card).
// Migrated from v0.65 HTML prototype.
// ============================================================

type RefPool = Record<string, Refinement[]>

export const REFINEMENT_POOL: RefPool = {
  damage:    [{ id: 'range_up',     name: '+1 Range',         desc: 'Attack range increased by 1.' },
              { id: 'armor_shred',  name: 'Armor Shred',      desc: 'Target loses 10% damage reduction this turn.' }],
  line:      [{ id: 'range_up',     name: '+1 Range',         desc: 'Attack range increased by 1.' },
              { id: 'accuracy_up',  name: 'Steady Hand',      desc: 'Miss chance reduced by 10%.' }],
  aoe:       [{ id: 'radius_up',    name: '+1 Radius',        desc: 'AOE area increases by 1 tile.' },
              { id: 'less_self',    name: 'Controlled Blast', desc: 'You no longer take friendly-fire damage from your own AOE.' }],
  heal:      [{ id: 'range_up',     name: '+1 Range',         desc: 'Heal range increased by 1.' },
              { id: 'overheal',     name: 'Overheal',         desc: 'Can heal beyond max HP by 10 (temporary).' }],
  dash:      [{ id: 'range_up',     name: '+1 Move',          desc: 'Dash movement range increased by 1.' },
              { id: 'leave_trail',  name: 'Afterimage',       desc: 'Leave a 1-turn copy that blocks the tile after dashing.' }],
  shield:    [{ id: 'longer_shield',name: 'Reinforced',       desc: 'Shield now lasts 3 turns instead of 2.' },
              { id: 'reflect',      name: 'Reflect 5',        desc: 'Reflect 5 damage to attacker when shield absorbs.' }],
  stealth:   [{ id: 'faster_invis', name: 'Quick Vanish',     desc: 'Invisibility applies at the start of your turn, not end.' },
              { id: 'ambush_boost', name: '+Ambush Bonus',    desc: 'Ambush damage bonus increases to +65%.' }],
  leech:     [{ id: 'range_up',     name: '+1 Range',         desc: 'Leech range increased by 1.' },
              { id: 'better_drain', name: 'Deep Drain',       desc: 'Leech heals 60% of damage dealt instead of 50%.' }],
  push:      [{ id: 'extra_push',   name: 'Stronger Push',    desc: 'Knockback distance increased to 3 tiles.' },
              { id: 'range_up',     name: '+1 Range',         desc: 'Push range increased by 1.' }],
  slow:      [{ id: 'longer_slow',  name: 'Extended Slow',    desc: 'Slow duration increased to 3 turns.' },
              { id: 'range_up',     name: '+1 Range',         desc: 'Slow range increased by 1.' }],
  mark:      [{ id: 'longer_mark',  name: 'Persistent Mark',  desc: 'Mark duration increased to 3 turns.' },
              { id: 'range_up',     name: '+1 Range',         desc: 'Mark range increased by 1.' }],
  cleanse:   [{ id: 'range_up',         name: '+1 Range',     desc: 'Cleanse range increased by 1.' },
              { id: 'regen_on_cleanse', name: 'Restorative',  desc: 'Target also gains Regen for 1 turn after cleansing.' }],
  reveal:    [{ id: 'reveal_longer', name: 'Long Track',      desc: 'Reveal/track duration increased to 5 turns.' },
              { id: 'range_up',      name: '+1 Range',        desc: 'Reveal range increased by 1.' }],
  selfbuff:  [{ id: 'extra_emp',    name: 'Extended Buff',    desc: 'Self-buff duration increased by 1 turn.' },
              { id: 'instant',      name: 'Instant Cast',     desc: 'Self-buff no longer costs your ability action this turn (1 use).' }],
  double:    [{ id: 'no_stun_after',name: 'Smooth Double',    desc: 'Double Action no longer triggers Stunned After curse.' },
              { id: 'extra_punch',  name: 'Combo Punch',      desc: 'Bonus free punch (10 dmg) at the end of your double turn.' }],
  scan:      [{ id: 'reveal_longer',name: 'Long Scan',        desc: 'Scan reveal duration increased to 5 turns.' },
              { id: 'range_up',     name: '+1 Radius',        desc: 'Scan radius increased by 1 tile.' }],
  scan_all:  [{ id: 'reveal_longer',name: 'Long Pulse',       desc: 'Full radar reveal lasts 2 turns instead of 1.' },
              { id: 'scan_stun',    name: 'Pulse Shock',      desc: 'Enemies are briefly confused (1 turn) when first revealed by radar.' }],
  teleport:  [{ id: 'range_up',     name: '+1 Teleport',     desc: 'Teleport range increased by 1 tile.' },
              { id: 'entry_strike', name: 'Entry Strike',     desc: 'Deal 10 damage to any enemy adjacent to your landing spot.' }],
  aoe_buff:  [{ id: 'extra_emp',    name: 'Extended Cry',     desc: 'War Cry buffs last 2 turns instead of 1.' },
              { id: 'aoe_buff_hp',  name: 'Rally Health',     desc: 'Also restore 8 HP to each ally when War Cry activates.' }],
  chain:     [{ id: 'range_up',     name: '+1 Range',         desc: 'Chain range increased by 1.' },
              { id: 'longer_slow',  name: 'Deeper Chain',     desc: 'Spread duration increased by 1 turn.' }],
}

export function getRefineOptions(power: Power): Refinement[] {
  const pool = REFINEMENT_POOL[power.type] ?? REFINEMENT_POOL['damage'] ?? []
  return pool.slice(0, 2)
}

// Apply a refinement id to a power copy (returns mutated copy, never mutates original)
export function applyRefinements(refinementIds: string[], power: Power): Power {
  if (!refinementIds.length) return power
  const p = { ...power }
  for (const refId of refinementIds) {
    switch (refId) {
      case 'range_up':          p._rangeBonus    = (p._rangeBonus    ?? 0) + 1; break
      case 'radius_up':         p._radiusBonus   = (p._radiusBonus   ?? 0) + 1; break
      case 'accuracy_up':       p._accuracyBonus = (p._accuracyBonus ?? 0) + 0.1; break
      case 'armor_shred':       p._armorShred    = true; break
      case 'longer_shield':     p._shieldDur     = 3; break
      case 'reflect':           p._reflect       = 5; break
      case 'faster_invis':      p._fastInvis     = true; break
      case 'ambush_boost':      p._ambushBonus   = 0.65; break
      case 'better_drain':      p._leechRate     = 0.6; break
      case 'extra_push':        p._pushDist      = 3; break
      case 'longer_slow':       p._slowDur       = 3; break
      case 'longer_mark':       p._markDur       = 3; break
      case 'regen_on_cleanse':  p._regenOnCleanse = true; break
      case 'reveal_longer':     p._revealDur     = 5; break
      case 'extra_emp':         p._buffDur       = 3; break
      case 'no_stun_after':     p._noStunAfter   = true; break
      case 'extra_punch':       p._extraPunch    = true; break
      case 'scan_stun':         p._scanStun      = true; break
      case 'entry_strike':      p._entryStrike   = true; break
      case 'aoe_buff_hp':       p._buffHeal      = 8; break
      case 'overheal':          p._overheal      = 10; break
      case 'less_self':         p._noSelfAoe     = true; break
    }
  }
  return p
}
