import type { WaveDef, CampBuff, Unit } from './types'

export const WAVE_DEFS: WaveDef[] = [
  { label: 'WAVE 1', icon: '💀',     desc: 'Normal enemies',    hpBonus: 0,  dmgBonus: 0  },
  { label: 'WAVE 2', icon: '💀💀',  desc: 'Stronger +15 HP',   hpBonus: 15, dmgBonus: 5  },
  { label: 'WAVE 3', icon: '☠☠☠', desc: 'ELITE +30 HP',      hpBonus: 30, dmgBonus: 10 },
]

export const CAMP_BUFFS: CampBuff[] = [
  {
    id: 'iron_skin', icon: '🛡', name: 'Iron Skin',
    desc: 'All units +20 max HP for next battle.',
    apply: (units: Unit[]) => units.filter(u => u.team === 'player').forEach(u => {
      u.maxHp += 20; u.hp = Math.min(u.hp + 20, u.maxHp)
    }),
  },
  {
    id: 'battle_rush', icon: '⚡', name: 'Battle Rush',
    desc: 'All units Empowered for first 2 turns.',
    apply: (units: Unit[]) => units.filter(u => u.team === 'player').forEach(u => {
      u.statuses.empowered = { dur: 2 }
    }),
  },
  {
    id: 'regen_field', icon: '💚', name: 'Regen Field',
    desc: 'All units regen 8 HP/turn for 3 turns.',
    apply: (units: Unit[]) => units.filter(u => u.team === 'player').forEach(u => {
      u.statuses.regen = { dur: 3 }
    }),
  },
  {
    id: 'haste_field', icon: '💨', name: 'Haste Field',
    desc: 'All units Hasted for 2 turns.',
    apply: (units: Unit[]) => units.filter(u => u.team === 'player').forEach(u => {
      u.statuses.hasted = { dur: 2 }
    }),
  },
  {
    id: 'mass_cleanse', icon: '✨', name: 'Mass Cleanse',
    desc: 'Remove all negative effects from every unit.',
    apply: (units: Unit[]) => units.filter(u => u.team === 'player').forEach(u => {
      const debuffs = ['poison', 'burn', 'weakened', 'slowed', 'confused', 'stunned'] as const
      debuffs.forEach(k => delete u.statuses[k])
    }),
  },
  {
    id: 'sharpened', icon: '🗡', name: 'Sharpened',
    desc: 'Empowered 2 turns — sharper strikes.',
    apply: (units: Unit[]) => units.filter(u => u.team === 'player').forEach(u => {
      u.statuses.empowered = { dur: 2 }
    }),
  },
]

export function pickCampBuffs(count = 3): CampBuff[] {
  const shuffled = [...CAMP_BUFFS].sort(() => Math.random() - 0.5)
  return shuffled.slice(0, count)
}
