import type { Unit, Power, Curse, Team, Personality, ForgedEntry } from '@data/types'
import { getPowerById, ALL_POWERS } from '@data/powers'
import { getCurseById, ALL_CURSES } from '@data/curses'
import { applyRefinements } from '@data/refinements'
import { applyStartStatuses } from './StatusEngine'
import { getDiffConfig } from '@data/difficulty'
import type { Difficulty } from '@data/types'

// ============================================================
// UNIT FACTORY
// Constructs Unit objects from forged card entries and for
// enemy generation.  Pure logic — no UI, no Phaser.
// Migrated from v0.65 HTML prototype buildUnits().
// ============================================================

const VISION_DEFAULT = 5
const PLAYER_ICONS = ['🧍', '🧟', '🤖', '💂', '🧙']
const ENEMY_ICONS  = ['👹', '👺', '💀', '🧛', '👻']

function rnd(n: number): number {
  return Math.floor(Math.random() * n)
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = rnd(i + 1);
    [a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/** Determine AI personality from power + curse combination. */
export function assignPersonality(power: Power, curse: Curse): Personality {
  const dmgTypes = ['damage', 'line', 'aoe', 'leech', 'dash']
  const aggCurses = ['glass_body', 'energy_burnout', 'random_move']
  if (dmgTypes.includes(power.type) && aggCurses.includes(curse.id)) return 'aggressive'

  const defPowers = ['heal', 'shield', 'selfbuff', 'cleanse']
  const defCurses = ['locked_pos', 'slow_react']
  if (defPowers.includes(power.type) || defCurses.includes(curse.id)) return 'defensive'

  const trkPowers = ['stealth', 'slow', 'mark', 'scan', 'reveal', 'double']
  const trkCurses = ['unstable_core', 'delayed_action', 'fragile_mind']
  if (trkPowers.includes(power.type) || trkCurses.includes(curse.id)) return 'trickster'

  return (['aggressive', 'defensive', 'trickster'] as Personality[])[rnd(3)]
}

/** Build a player unit from a squad slot. */
export function buildPlayerUnit(
  entry: ForgedEntry,
  slotIndex: number
): Unit {
  const basePower = getPowerById(entry.powerId)
  const curse     = getCurseById(entry.curseId)
  if (!basePower || !curse) throw new Error(`Invalid forged entry: ${entry.powerId} / ${entry.curseId}`)

  const power = applyRefinements(entry.refinements, basePower)
  const spd   = (curse.id === 'slow_react' || curse.id === 'delayed_reflex') ? 1 : (10 + rnd(6))
  const vision = curse.id === 'blind' ? 2 : VISION_DEFAULT

  const unit: Unit = {
    id:             `player_${slotIndex}`,
    name:           `UNIT ${slotIndex + 1}`,
    icon:           PLAYER_ICONS[slotIndex % PLAYER_ICONS.length],
    team:           'player',
    power,
    downside:       curse,
    maxHp:          100,
    hp:             100,
    speed:          spd,
    vision,
    personality:    assignPersonality(power, curse),
    statuses:       {},
    turnCount:      0,
    pendingAbility: null,
    pos:            { r: 0, c: 0 }, // set by MapBuilder.placeUnits
  }

  applyStartStatuses(unit)
  return unit
}

/** Build all 5 enemy units for a wave with difficulty scaling. */
export function buildEnemyUnits(
  hpBonus:  number,
  dmgBonus: number,
  difficulty: Difficulty
): Unit[] {
  const dc  = getDiffConfig(difficulty)
  const hp  = Math.round((100 + hpBonus) * dc.hpMult)
  const dmgB = Math.round(dmgBonus + (dc.dmgMult - 1) * 15)

  const dmgPool  = shuffle(ALL_POWERS.filter(p => ['damage', 'line', 'aoe', 'leech', 'dash'].includes(p.type)))
  const utilPool = shuffle(ALL_POWERS.filter(p => ['heal', 'shield', 'selfbuff', 'cleanse', 'slow', 'mark', 'double', 'push', 'stealth', 'scan', 'reveal'].includes(p.type)))
  const allPool  = shuffle([...ALL_POWERS])
  const cursePool = shuffle([...ALL_CURSES])

  const powers = [
    dmgPool[0]  ?? allPool[0],
    dmgPool[1]  ?? allPool[1],
    utilPool[0] ?? allPool[2],
    shuffle([...allPool])[0],
    shuffle([...allPool])[1],
  ]

  return powers.map((power, i) => {
    const curse = cursePool[i] ?? ALL_CURSES[i % ALL_CURSES.length]
    const spd   = (curse.id === 'slow_react' || curse.id === 'delayed_reflex') ? 1 : (5 + rnd(8))
    const vision = curse.id === 'blind' ? 2 : VISION_DEFAULT

    const unit: Unit = {
      id:             `enemy_${i}`,
      name:           `FOE ${i + 1}`,
      icon:           ENEMY_ICONS[i % ENEMY_ICONS.length],
      team:           'enemy',
      power,
      downside:       curse,
      maxHp:          hp,
      hp,
      speed:          spd,
      vision,
      personality:    assignPersonality(power, curse),
      statuses:       {},
      turnCount:      0,
      pendingAbility: null,
      pos:            { r: 0, c: 0 },
      _dmgBonus:      dmgB,
    }

    applyStartStatuses(unit)
    return unit
  })
}

/** Restore campaign units between waves — clears battle statuses but keeps buffs. */
export function restoreCampaignUnit(unit: Unit): Unit {
  const u = JSON.parse(JSON.stringify(unit)) as Unit
  const clearKeys = ['stunned', 'hasted', 'slowed', 'confused', 'marked', 'reveal'] as const
  clearKeys.forEach(k => delete u.statuses[k])
  u.turnCount = 0
  u.pendingAbility = null
  return u
}
