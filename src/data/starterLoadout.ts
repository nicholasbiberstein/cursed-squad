import type { ForgedEntry } from './types'

// ============================================================
// STARTER LOADOUT
// 5 pre-forged cards injected on first launch so players can
// open the game → build a squad → play immediately.
// Migrated from v0.65 HTML prototype.
// ============================================================
export const STARTER_LOADOUT: ForgedEntry[] = [
  { powerId: 'strike',         curseId: 'health_drain',  rerollCount: 0, refinements: [], isStarter: true },
  { powerId: 'sniper_shot',    curseId: 'unstable_aim',  rerollCount: 0, refinements: [], isStarter: true },
  { powerId: 'short_dash',     curseId: 'delayed_action',rerollCount: 0, refinements: [], isStarter: true },
  { powerId: 'fortify_common', curseId: 'slow_react',    rerollCount: 0, refinements: [], isStarter: true },
  { powerId: 'scout_ping',     curseId: 'blind',          rerollCount: 0, refinements: [], isStarter: true },
]
