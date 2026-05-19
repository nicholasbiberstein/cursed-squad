// ============================================================
// MYTHICAL EVENT MANAGER
// Handles roulette spins, dungeon progress, ticket tracking
// ============================================================

import { supabase } from './supabase'
import { useStore } from '@store'
import { save } from '@systems/SaveManager'
import {
  spinRoulette, getActiveEvent,
  type MythicalEvent, type RoulettePrize, type DungeonPowerup,
} from '@data/mythicalEvents'

export interface MythicalProgress {
  tickets:          number
  spinsToday:       number
  spinsDate:        string | null
  paidSpins:        number
  dungeonLevel:     number       // 0 = not started, 1-5 = current level
  dungeonHp:        Record<string, number>   // unitId -> current hp
  dungeonUnits:     any[]        // squad used in dungeon
  dungeonPowerups:  string[]     // powerup IDs collected
  mythicalsOwned:   string[]     // event IDs where mythical was earned
  ticketPurchases:  Record<string, number>   // itemId -> times purchased
}

const DEFAULT: MythicalProgress = {
  tickets:         0,
  spinsToday:      0,
  spinsDate:       null,
  paidSpins:       0,
  dungeonLevel:    0,
  dungeonHp:       {},
  dungeonUnits:    [],
  dungeonPowerups: [],
  mythicalsOwned:  [],
  ticketPurchases: {},
}

let _prog: MythicalProgress = { ...DEFAULT }

export function getMythicalProgress(): MythicalProgress { return _prog }

export async function loadMythicalProgress(userId: string): Promise<MythicalProgress> {
  const { data, error } = await supabase
    .from('mythical_progress')
    .select('*')
    .eq('player_id', userId)
    .single()

  if (error || !data) {
    await supabase.from('mythical_progress').insert({ player_id: userId })
    _prog = { ...DEFAULT }
  } else {
    const today = new Date().toISOString().split('T')[0]
    _prog = {
      tickets:          data.tickets          ?? 0,
      spinsToday:       data.spins_date === today ? (data.spins_today ?? 0) : 0,
      spinsDate:        data.spins_date        ?? null,
      paidSpins:        data.paid_spins        ?? 0,
      dungeonLevel:     data.dungeon_level     ?? 0,
      dungeonHp:        data.dungeon_hp        ?? {},
      dungeonUnits:     data.dungeon_units     ?? [],
      dungeonPowerups:  data.dungeon_powerups  ?? [],
      mythicalsOwned:   data.mythicals_owned   ?? [],
      ticketPurchases:  data.ticket_purchases  ?? {},
    }
  }

  useStore.setState({ mythicalProgress: { ..._prog } })
  return _prog
}

async function saveProg(userId: string) {
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('mythical_progress').upsert({
    player_id:         userId,
    tickets:           _prog.tickets,
    spins_today:       _prog.spinsToday,
    spins_date:        today,
    paid_spins:        _prog.paidSpins,
    dungeon_level:     _prog.dungeonLevel,
    dungeon_hp:        _prog.dungeonHp,
    dungeon_units:     _prog.dungeonUnits,
    dungeon_powerups:  _prog.dungeonPowerups,
    mythicals_owned:   _prog.mythicalsOwned,
    ticket_purchases:  _prog.ticketPurchases,
    updated_at:        new Date().toISOString(),
  }, { onConflict: 'player_id' })
  useStore.setState({ mythicalProgress: { ..._prog } })
}

// ── FREE SPIN (costs 10 diamonds) ─────────────────────────────
export const FREE_SPINS_PER_DAY = 10
export const SPIN_DIAMOND_COST  = 10

export function canFreeSpin(): boolean {
  return _prog.spinsToday < FREE_SPINS_PER_DAY && save.diamonds >= SPIN_DIAMOND_COST
}

export function hasPaidSpins(): boolean {
  return _prog.paidSpins > 0
}

export async function doSpin(userId: string, isPaid: boolean): Promise<{ prize: RoulettePrize; tickets: number } | null> {
  const event = getActiveEvent()
  if (!event) return null

  if (isPaid) {
    if (_prog.paidSpins <= 0) return null
    _prog.paidSpins -= 1
  } else {
    if (_prog.spinsToday >= FREE_SPINS_PER_DAY) return null
    if (save.diamonds < SPIN_DIAMOND_COST) return null
    save.diamonds -= SPIN_DIAMOND_COST
    save.persistCoins()
    useStore.setState({ diamonds: save.diamonds })
    _prog.spinsToday += 1
  }

  // Always give 1 ticket
  _prog.tickets += 1

  // Spin for prize
  const prize = spinRoulette()

  // Apply prize
  switch (prize.type) {
    case 'coins':         save.coins    += prize.amount; save.persistCoins(); useStore.setState({ coins: save.coins }); break
    case 'diamonds':      save.diamonds += prize.amount; save.persistCoins(); useStore.setState({ diamonds: save.diamonds }); break
    case 'common_token':  { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, commonTokens: (es.commonTokens ?? 0) + prize.amount } }); break }
    case 'rare_token':    { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, rareTokens: (es.rareTokens ?? 0) + prize.amount } }); break }
    case 'epic_token':    { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, commonTokens: (es.commonTokens ?? 0) + prize.amount } }); break }
    case 'mythical_power': await grantMythical(userId, event); break
  }

  await saveProg(userId)
  return { prize, tickets: _prog.tickets }
}

// ── ADD PAID SPINS (called by webhook after purchase) ─────────
export async function addPaidSpins(userId: string, spins: number, bonus: {
  coins?: number; diamonds?: number; commonTokens?: number; rareTokens?: number; legendaryTokens?: number
}) {
  _prog.paidSpins += spins
  if (bonus.coins)         { save.coins    += bonus.coins;    save.persistCoins(); useStore.setState({ coins: save.coins }) }
  if (bonus.diamonds)      { save.diamonds += bonus.diamonds; save.persistCoins(); useStore.setState({ diamonds: save.diamonds }) }
  await saveProg(userId)
}

// ── GRANT MYTHICAL ────────────────────────────────────────────
async function grantMythical(userId: string, event: MythicalEvent) {
  const alreadyOwns = _prog.mythicalsOwned.includes(event.id)
  if (!alreadyOwns) {
    _prog.mythicalsOwned = [..._prog.mythicalsOwned, event.id]
  }

  // Add to forged collection
  const forged = useStore.getState().forged
  const existing = forged.find(f => f.powerId === event.powerId)
  if (existing) {
    const updated = forged.map(f => f.powerId === event.powerId
      ? { ...f, duplicates: (f.duplicates ?? 0) + 1 }
      : f
    )
    save.forged = updated
  } else {
    // New mythical — needs curse binding (handled in UI)
    useStore.setState({ pendingMythicalPowerId: event.powerId })
  }
  save.persistForged()
}

// ── DUNGEON ───────────────────────────────────────────────────
export async function startDungeon(userId: string, squad: any[]) {
  _prog.dungeonLevel    = 1
  _prog.dungeonUnits    = squad.map(u => ({ ...u, hp: u.maxHp }))
  _prog.dungeonHp       = {}
  _prog.dungeonPowerups = []
  squad.forEach(u => { _prog.dungeonHp[u.id] = u.maxHp })
  await saveProg(userId)
}

export async function completeDungeonLevel(userId: string, survivors: any[], level: number) {
  // Save HP of surviving units
  const newHp: Record<string, number> = {}
  survivors.forEach(u => { newHp[u.id] = u.hp })
  _prog.dungeonHp    = newHp
  _prog.dungeonUnits = survivors
  _prog.dungeonLevel = level + 1  // advance to next level
  await saveProg(userId)
}

export async function applyDungeonPowerup(userId: string, powerupId: string) {
  _prog.dungeonPowerups = [..._prog.dungeonPowerups, powerupId]
  await saveProg(userId)
}

export async function completeDungeon(userId: string) {
  const event = getActiveEvent()
  if (event) await grantMythical(userId, event)
  _prog.dungeonLevel    = 0
  _prog.dungeonUnits    = []
  _prog.dungeonHp       = {}
  _prog.dungeonPowerups = []
  await saveProg(userId)
}

export async function resetDungeon(userId: string) {
  _prog.dungeonLevel    = 0
  _prog.dungeonUnits    = []
  _prog.dungeonHp       = {}
  _prog.dungeonPowerups = []
  await saveProg(userId)
}

// ── TICKET STORE ──────────────────────────────────────────────
export async function buyTicketItem(userId: string, itemId: string): Promise<boolean> {
  const { TICKET_STORE } = await import('@data/mythicalEvents')
  const item = TICKET_STORE.find(i => i.id === itemId)
  if (!item) return false
  if (_prog.tickets < item.cost) return false

  // Check one-time limit
  if (item.oneTime) {
    const event = getActiveEvent()
    const key   = `${event?.id}_${itemId}`
    if (_prog.ticketPurchases[key]) return false
    _prog.ticketPurchases = { ..._prog.ticketPurchases, [key]: 1 }
  }

  _prog.tickets -= item.cost

  // Apply item
  const event = getActiveEvent()
  switch (item.type) {
    case 'coins':           save.coins    += item.amount; save.persistCoins(); useStore.setState({ coins: save.coins }); break
    case 'diamonds':        save.diamonds += item.amount; save.persistCoins(); useStore.setState({ diamonds: save.diamonds }); break
    case 'common_token':    { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, commonTokens: (es.commonTokens??0)+item.amount } }); break }
    case 'rare_token':      { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, rareTokens: (es.rareTokens??0)+item.amount } }); break }
    case 'epic_token':      { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, commonTokens: (es.commonTokens??0)+item.amount } }); break }
    case 'legendary_token': { const es = useStore.getState().eventState; if (es) useStore.setState({ eventState: { ...es, rareTokens: (es.rareTokens??0)+item.amount } }); break }
    case 'mythical_power':  if (event) await grantMythical(userId, event); break
    case 'mythical_dupe':   if (event) await grantMythical(userId, event); break
  }

  await saveProg(userId)
  return true
}