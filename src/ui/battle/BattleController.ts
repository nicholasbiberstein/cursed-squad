import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { applyRefinements } from '@data/refinements'
import { getDiffConfig } from '@data/difficulty'
import { WAVE_DEFS } from '@data/campaign'
import { buildTurnOrder, checkWinLose, freshAct } from '@systems/TurnManager'
import {
  tickStatuses, applyStartStatuses, getDoTDamage, getRegenAmount,
  applyRandomStatus, isStunned, breakInvisOnAttack, applyAdrenalCrash,
} from '@systems/StatusEngine'
import {
  applyDamage, applyHeal, applyBackfire, applyPush,
  shouldMiss, applyStunAfter, calcDamageMultiplier,
} from '@systems/CombatEngine'
import { computeVisibility, revealUnit, hasLoS, tickFogReveal } from '@systems/VisibilityEngine'
import { buildMap, placeUnits, moveUnitOnGrid, GSIZE } from '@systems/MapBuilder'
import { buildEnemyUnits, restoreCampaignUnit } from '@systems/UnitFactory'
import { save } from '@systems/SaveManager'
import { decideAction } from '@ai/PersonalityAI'
import type { Unit, Power, GridPos, PreviewState } from '@data/types'
import { SFX } from '@ui/AudioEngine'

// ============================================================
// BATTLE CONTROLLER — New turn system
//
// PLAYER PHASE:
//   - Player selects any of their units freely
//   - Each unit has 1 move + 1 combat action (ability OR punch)
//   - Player clicks END TURN when done with all units
//
// ENEMY PHASE:
//   - All enemies act in speed order, one at a time
//   - After all enemies resolve, player phase begins again
//
// BUG FIXES:
//   - Ranged attacks enforce LoS + wall blocking
//   - Line attacks (sniper) only fire in 4 cardinal directions
// ============================================================

// ── Animation callbacks (registered by Phaser scene) ─────────
let _animateHit:   ((id: string) => void) | null = null
let _animateHeal:  ((id: string) => void) | null = null
let _animateDeath: ((id: string) => void) | null = null
let _spawnNumber:  ((id: string, text: string, type: 'dmg'|'heal'|'miss') => void) | null = null
let _popStatus:    ((id: string, text: string, color: string) => void) | null = null
let _renderGrid:   (() => void) | null = null

export function registerAnimations(fns: {
  hit?:    (id: string) => void
  heal?:   (id: string) => void
  death?:  (id: string) => void
  number?: (id: string, text: string, type: 'dmg'|'heal'|'miss') => void
  status?: (id: string, text: string, color: string) => void
  render?: () => void
}) {
  if (fns.hit)    _animateHit    = fns.hit
  if (fns.heal)   _animateHeal   = fns.heal
  if (fns.death)  _animateDeath  = fns.death
  if (fns.number) _spawnNumber   = fns.number
  if (fns.status) _popStatus     = fns.status
  if (fns.render) _renderGrid    = fns.render
}

const animHit    = (id: string) => _animateHit?.(id)
const animHeal   = (id: string) => _animateHeal?.(id)
const animDeath  = (id: string) => _animateDeath?.(id)
const spawnNum   = (id: string, t: string, type: 'dmg'|'heal'|'miss') => _spawnNumber?.(id, t, type)
const popSts     = (id: string, t: string, c: string) => _popStatus?.(id, t, c)
const renderGrid = () => _renderGrid?.()

const getStore = () => useStore.getState()
const isDead   = (u: Unit) => u.hp <= 0

function pushLog(msg: string, type = 'sys') {
  useStore.setState(s => ({ log: [...(s.log ?? []), { msg, type, id: Date.now() + Math.random() }] } as any))
}
function syncUnits(units: Unit[]) { useStore.setState({ units: [...units] }) }
function syncVisible() {
  const s = getStore()
  useStore.setState({ visibleCells: computeVisibility(s.units, s.walls, s.fogReveal) })
}

// ── LoS helper for ranged attacks ─────────────────────────────
function rangedCanHit(attacker: Unit, target: Unit, walls: Set<string>): boolean {
  return hasLoS(attacker.pos, target.pos, walls)
}

// ── INIT BATTLE ───────────────────────────────────────────────
export function initBattle() {
  const s = getStore()
  const { mode, campWave, campUnits, buildSlots, difficulty } = s
  const { grid, walls, covers } = buildMap()
  let units: Unit[] = []

  if (mode === 'campaign' && campUnits && campUnits.length > 0) {
    units = campUnits.map(u => restoreCampaignUnit(u))
    units.forEach(u => {
      const entry = save.getForged(u.power.id)
      const base  = ALL_POWERS.find(p => p.id === u.power.id) ?? u.power
      u.power    = entry ? applyRefinements(entry.refinements, base) : base
      u.downside = ALL_CURSES.find(c => c.id === u.downside.id) ?? u.downside
    })
    const wave    = WAVE_DEFS[campWave] ?? WAVE_DEFS[0]
    units         = [...units, ...buildEnemyUnits(wave.hpBonus, wave.dmgBonus, difficulty)]
  } else {
    buildSlots.forEach((slot, i) => {
      if (!slot) return
      const u     = slot as Unit
      const entry = save.getForged(u.power.id)
      const base  = ALL_POWERS.find(p => p.id === u.power.id) ?? u.power
      const power = entry ? applyRefinements(entry.refinements, base) : base
      const curse = ALL_CURSES.find(c => c.id === u.downside.id) ?? u.downside
      const fresh: Unit = { ...u, power, downside: curse, hp: 100, maxHp: 100, statuses: {}, turnCount: 0, pendingAbility: null, pos: { r: 0, c: 0 } }
      applyStartStatuses(fresh)
      units.push(fresh)
    })
    units = [...units, ...buildEnemyUnits(0, 0, difficulty)]
  }

  placeUnits(units, grid)
  const fogReveal    = new Map<string, number>()
  const visibleCells = computeVisibility(units, walls, fogReveal)

  // Build per-unit action budgets
  const unitActs: Record<string, { moved: boolean; acted: boolean }> = {}
  units.filter(u => u.team === 'player').forEach(u => { unitActs[u.id] = { moved: false, acted: false } })

  // Record start HP for all units
  const turnStartHP: Record<string, number> = {}
  units.forEach(u => { turnStartHP[u.id] = u.hp })

  useStore.setState({
    units, grid, walls, covers,
    round: 1, battlePhase: 'idle',
    selectedUnitId: null, unitActs, enemyQueue: [],
    phase: 'idle', preview: null, undoPos: null,
    visibleCells, fogReveal, turnStartHP,
    log: [] as any,
  })

  setTimeout(() => startPlayerPhase(), 400)
}

// ── PLAYER PHASE ──────────────────────────────────────────────
export function startPlayerPhase() {
  const s = getStore()

  // Apply start-of-round effects for all player units
  const units = s.units
  units.filter(u => u.team === 'player' && !isDead(u)).forEach(u => {
    applyRoundStartEffects(u)
  })

  // Reset action budgets for all living player units
  const unitActs: Record<string, { moved: boolean; acted: boolean }> = {}
  units.filter(u => u.team === 'player' && !isDead(u)).forEach(u => {
    unitActs[u.id] = { moved: false, acted: false }
  })

  // Record HP at start of round for rewind
  const turnStartHP: Record<string, number> = {}
  units.forEach(u => { turnStartHP[u.id] = u.hp })

  // Tick fog reveal
  tickFogReveal(s.fogReveal)

  syncUnits(units)
  syncVisible()
  renderGrid()
  SFX.turn_start()

  // Auto-select first living player unit
  const first = units.find(u => u.team === 'player' && !isDead(u))

  useStore.setState({
    battlePhase:    'player',
    selectedUnitId: first?.id ?? null,
    unitActs,
    turnStartHP,
    phase:          'idle',
    preview:        null,
    undoPos:        null,
  })
}

// ── ROUND-START EFFECTS FOR A UNIT ────────────────────────────
function applyRoundStartEffects(u: Unit) {
  const s = getStore()

  if (u.downside.id === 'decay') {
    u.maxHp = Math.max(10, u.maxHp - 5)
    u.hp    = Math.min(u.hp, u.maxHp)
    pushLog(`${u.name} decays → ${u.maxHp} max`, 'sys')
  }

  const crash = applyAdrenalCrash(u)
  if (crash === 'empowered') popSts(u.id, 'EMPOWERED!', '#fc0')
  if (crash === 'stunned')   popSts(u.id, 'CRASH!', '#bbb')

  if (u.downside.id === 'signal_leak' && u.turnCount % 2 === 0) {
    revealUnit(u, 1, s.fogReveal); pushLog(`${u.name} revealed!`, 'fog-log')
  }
  if (u.downside.id === 'unstable_core') {
    const k = applyRandomStatus(u); popSts(u.id, k.toUpperCase() + '!', '#c0f'); SFX.status_apply()
  }
  if (u.downside.id === 'health_drain') {
    u.hp = Math.max(0, u.hp - 8)
    pushLog(`${u.name} -8 (drain)`, 'dmg'); spawnNum(u.id, '-8', 'dmg'); animHit(u.id); SFX.hit()
  }
  if (u.downside.id === 'random_move') doRandomMove(u)

  const { poison, burn } = getDoTDamage(u)
  if (poison > 0) { u.hp = Math.max(0, u.hp - poison); pushLog(`${u.name} -${poison} (poison)`, 'dmg'); spawnNum(u.id, `-${poison}`, 'dmg'); animHit(u.id); SFX.hit() }
  if (burn   > 0) { u.hp = Math.max(0, u.hp - burn);   pushLog(`${u.name} -${burn} (burn)`, 'dmg');   spawnNum(u.id, `-${burn}`,   'dmg'); animHit(u.id); SFX.hit() }

  const regen = getRegenAmount(u)
  if (regen > 0) { u.hp += regen; pushLog(`${u.name} regens +${regen}`, 'hl'); spawnNum(u.id, `+${regen}`, 'heal'); animHeal(u.id); SFX.heal() }

  // Fire pending (delayed) abilities
  if (u.pendingAbility) {
    const pa = u.pendingAbility; u.pendingAbility = null
    pushLog(`${u.name} delayed fires!`, 'sys')
    resolveEffect(u, pa.targets, pa.center, pa.power)
  }

  u.turnCount++
  tickStatuses(u)
}

// ── SELECT A PLAYER UNIT ──────────────────────────────────────
export function selectUnit(unitId: string) {
  const s = getStore()
  if (s.battlePhase !== 'player') return
  const u = s.units.find(x => x.id === unitId)
  if (!u || u.team !== 'player' || isDead(u)) return
  SFX.click()
  useStore.setState({ selectedUnitId: unitId, phase: 'idle', preview: null, undoPos: null })
  renderGrid()
}

function getSelectedUnit(): Unit | undefined {
  const s = getStore()
  return s.units.find(u => u.id === s.selectedUnitId)
}

// ── END PLAYER TURN → start enemy phase ───────────────────────
export function endPlayerTurn() {
  const s = getStore()
  if (s.battlePhase !== 'player') return
  SFX.click()
  useStore.setState({ battlePhase: 'enemy', selectedUnitId: null, phase: 'idle', preview: null })

  // Apply end-of-round passives for player units
  s.units.filter(u => u.team === 'player' && !isDead(u)).forEach(u => {
    if (u.downside.id === 'loud_movement' && (s.unitActs[u.id]?.moved)) {
      revealUnit(u, 1, s.fogReveal)
    }
  })

  // Check win/lose before enemies act
  const result = checkWinLose(s.units)
  if (result !== 'ongoing') { handleEnd(result === 'player_wins'); return }

  // Queue up all living enemies sorted by speed
  const enemyOrder = s.units
    .filter(u => u.team === 'enemy' && !isDead(u))
    .sort((a, b) => b.speed - a.speed)
    .map(u => u.id)

  useStore.setState({ enemyQueue: enemyOrder })
  pushLog('— ENEMY PHASE —', 'sys')
  renderGrid()

  // Apply round-start effects for enemies then run their turns
  const dc = getDiffConfig(s.difficulty)
  setTimeout(() => runNextEnemy(), dc.aiDelay * 0.5)
}

// ── ENEMY PHASE: run one enemy at a time ──────────────────────
function runNextEnemy() {
  const s = getStore()
  if (s.battlePhase !== 'enemy') return

  const queue = [...s.enemyQueue]
  if (!queue.length) {
    // All enemies done — start next player round
    useStore.setState({ round: s.round + 1, enemyQueue: [] })
    const result = checkWinLose(s.units)
    if (result !== 'ongoing') { handleEnd(result === 'player_wins'); return }
    startPlayerPhase()
    return
  }

  const nextId = queue.shift()!
  useStore.setState({ enemyQueue: queue })

  const u = s.units.find(x => x.id === nextId)
  if (!u || isDead(u)) { setTimeout(runNextEnemy, 100); return }

  const dc = getDiffConfig(s.difficulty)

  // Apply round-start effects for this enemy
  applyRoundStartEffects(u)
  syncUnits(s.units)
  syncVisible()
  renderGrid()

  // Check if enemy died from DoT
  if (isDead(u)) {
    killUnit(u)
    setTimeout(runNextEnemy, dc.aiDelay * 0.6)
    return
  }

  // Stunned — skip
  if (isStunned(u)) {
    pushLog(`${u.name} stunned — skip!`, 'sys')
    tickStatuses(u)
    syncUnits(s.units)
    setTimeout(runNextEnemy, dc.aiDelay * 0.5)
    return
  }

  // Run AI
  setTimeout(() => {
    runEnemyTurn(u)
    setTimeout(runNextEnemy, dc.aiDelay)
  }, dc.aiDelay * 0.4)
}

// ── HANDLE BATTLE END ─────────────────────────────────────────
function handleEnd(win: boolean) {
  const s  = getStore()
  const dc = getDiffConfig(s.difficulty)
  const base = win ? (38 + Math.floor(Math.random() * 28)) : (14 + Math.floor(Math.random() * 14))
  save.coins += Math.round(base * dc.rewardMult)
  if (win && Math.random() < 0.2) save.diamonds += 1
  save.persistCoins()
  useStore.setState({ coins: save.coins, diamonds: save.diamonds })

  if (s.mode === 'campaign' && win) {
    const next = s.campWave + 1
    const survivors = s.units.filter(u => u.team === 'player' && u.hp > 0)
    useStore.setState({ campWave: next, campUnits: survivors })
    if (next >= 3) { save.coins += 120; save.diamonds += 2; save.persistCoins(); useStore.setState({ coins: save.coins, diamonds: save.diamonds }); SFX.campaign_win() }
    else SFX.victory()
  } else { win ? SFX.victory() : SFX.defeat() }

  setTimeout(() => useStore.setState({ screen: 'result' }), 700)
}

function killUnit(u: Unit) {
  const s = getStore()
  u.hp = 0
  s.grid[u.pos.r][u.pos.c] = null
  pushLog(`${u.name} eliminated ✝`, 'sys')
  animDeath(u.id)
  SFX.death()
  syncUnits(s.units)
  renderGrid()
  setTimeout(() => {
    const result = checkWinLose(getStore().units)
    if (result !== 'ongoing') handleEnd(result === 'player_wins')
  }, 500)
}

// ── PLAYER MOVE ───────────────────────────────────────────────
export function doMove(r: number, c: number) {
  const u = getSelectedUnit()
  if (!u || u.team !== 'player') return
  const s = getStore()
  if (s.battlePhase !== 'player') return

  const acts  = s.unitActs[u.id] ?? { moved: false, acted: false }
  if (acts.moved) { pushLog(`${u.name} already moved this round!`, 'sys'); return }
  if (u.downside.id === 'locked_pos') { pushLog(`${u.name} is locked in place!`, 'sys'); return }

  const range = (u.power.type === 'dash' ? 5 : 3) + (u.power._moveBonus ?? 0)
  if (s.grid[r]?.[c] || s.walls.has(`${r},${c}`)) return

  // BFS reachability
  const queue: Array<{r: number; c: number; steps: number}> = [{ r: u.pos.r, c: u.pos.c, steps: 0 }]
  const visited = new Set<string>([`${u.pos.r},${u.pos.c}`])
  let canReach = false
  outer: while (queue.length) {
    const { r: cr, c: cc, steps } = queue.shift()!
    if (cr === r && cc === c && steps > 0) { canReach = true; break }
    if (steps >= range) continue
    for (const [dr, dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
      const nr = cr+dr, nc = cc+dc, nk = `${nr},${nc}`
      if (nr<0||nr>=GSIZE||nc<0||nc>=GSIZE||visited.has(nk)||s.walls.has(nk)||s.grid[nr]?.[nc]) continue
      visited.add(nk); queue.push({ r: nr, c: nc, steps: steps+1 })
    }
  }
  if (!canReach) return

  const undoPos = { ...u.pos }
  moveUnitOnGrid(u, r, c, s.grid); SFX.move()
  if (u.downside.id === 'loud_movement') { revealUnit(u, 1, s.fogReveal); pushLog(`${u.name} revealed by movement!`, 'fog-log') }

  useStore.setState(st => ({
    unitActs: { ...st.unitActs, [u.id]: { ...st.unitActs[u.id], moved: true } },
    undoPos, phase: 'idle',
  }))
  syncUnits(s.units); syncVisible(); renderGrid()
}

export function doUndoMove() {
  const u = getSelectedUnit()
  const s = getStore()
  if (!u || !s.undoPos) return
  const acts = s.unitActs[u.id]
  if (!acts?.moved || acts.acted) return

  s.grid[u.pos.r][u.pos.c] = null; u.pos = { ...s.undoPos }; s.grid[u.pos.r][u.pos.c] = u.id
  useStore.setState(st => ({
    unitActs: { ...st.unitActs, [u.id]: { ...st.unitActs[u.id], moved: false } },
    undoPos: null, phase: 'idle',
  }))
  syncUnits(s.units); syncVisible(); renderGrid()
  pushLog(`${u.name} move undone.`, 'sys'); SFX.click()
}

// ── PLAYER PUNCH ──────────────────────────────────────────────
export function doPunch(targetId: string) {
  const u = getSelectedUnit()
  if (!u || u.team !== 'player') return
  const s = getStore()
  if (s.battlePhase !== 'player') return

  const acts = s.unitActs[u.id] ?? { moved: false, acted: false }
  if (acts.acted) { pushLog(`${u.name} already acted this round!`, 'sys'); return }

  const target = s.units.find(x => x.id === targetId)
  if (!target || isDead(target)) return
  const dist = Math.abs(u.pos.r - target.pos.r) + Math.abs(u.pos.c - target.pos.c)
  if (dist !== 1) return

  let dmg = 12
  if (target.statuses.marked)              dmg = Math.floor(dmg * 1.5)
  if (target.downside.id === 'glass_body') dmg = Math.floor(dmg * 1.5)
  if (target.statuses.shielded)            { dmg = Math.floor(dmg * 0.5); delete target.statuses.shielded }
  dmg = Math.max(1, dmg); target.hp = Math.max(0, target.hp - dmg)

  pushLog(`${u.name} punches ${target.name} -${dmg}`, 'punch')
  spawnNum(target.id, `-${dmg}`, 'dmg'); animHit(target.id); SFX.punch()

  useStore.setState(st => ({
    unitActs: { ...st.unitActs, [u.id]: { ...st.unitActs[u.id], acted: true } },
    phase: 'idle',
  }))
  syncUnits(s.units); renderGrid()
  if (isDead(target)) killUnit(target)
}

// ── PLAYER ABILITY ────────────────────────────────────────────
export function buildPreview(targets: Unit[], center: GridPos | null): PreviewState | null {
  const u = getSelectedUnit(); if (!u) return null
  return { unit: u, targets, center, power: u.power }
}

export function confirmAbility() {
  const s   = getStore()
  const pre = s.preview; if (!pre) return
  const { unit: u, targets, center, power } = pre
  if (s.battlePhase !== 'player') return

  const acts = s.unitActs[u.id] ?? { moved: false, acted: false }
  if (acts.acted) { pushLog(`${u.name} already acted this round!`, 'sys'); useStore.setState({ preview: null, phase: 'idle' }); return }

  SFX.ability()

  if (shouldMiss(u, power) && targets.length > 0) {
    pushLog(`${u.name} MISSES!`, 'mss'); spawnNum(u.id, 'MISS', 'miss'); SFX.miss()
    useStore.setState(st => ({ unitActs: { ...st.unitActs, [u.id]: { ...st.unitActs[u.id], acted: true } }, preview: null, phase: 'idle' }))
    applyBackfire(u); syncUnits(s.units); return
  }

  if (u.downside.id === 'delayed_action' && !u.statuses.stabilized && !u.pendingAbility) {
    u.pendingAbility = { targets, center, power }
    pushLog(`${u.name} charges ${power.name}...`, 'sys')
    useStore.setState(st => ({ unitActs: { ...st.unitActs, [u.id]: { ...st.unitActs[u.id], acted: true } }, preview: null, phase: 'idle' }))
    applyBackfire(u); syncUnits(s.units); return
  }

  const offTypes = ['damage', 'line', 'aoe', 'leech', 'push', 'chain']
  if (offTypes.includes(power.type) || power.isAmbush) breakInvisOnAttack(u)

  pushLog(`${u.name} uses ${power.name}!`, 'new')
  resolveEffect(u, targets, center, power)

  const bf = applyBackfire(u)
  if (bf > 0) { pushLog(`${u.name} backfire -${bf}`, 'dmg'); spawnNum(u.id, `-${bf}`, 'dmg'); animHit(u.id); if (isDead(u)) { syncUnits(s.units); killUnit(u); return } }

  // Double action — reset this unit's action budget once
  if (power.id === 'double_action' && !acts.acted) {
    useStore.setState(st => ({ unitActs: { ...st.unitActs, [u.id]: { moved: false, acted: false } }, preview: null, phase: 'idle' }))
    pushLog(`${u.name} double action! Acts again.`, 'sys')
  } else {
    useStore.setState(st => ({ unitActs: { ...st.unitActs, [u.id]: { ...st.unitActs[u.id], acted: true } }, preview: null, phase: 'idle' }))
  }

  if (applyStunAfter(u)) { pushLog(`${u.name} stunned after!`, 'sys'); popSts(u.id, 'STUNNED!', '#bbb') }

  syncUnits(s.units); syncVisible(); renderGrid()
}

export function cancelAbility() {
  useStore.setState({ preview: null, phase: 'ability' }); SFX.click()
}

// ── RESOLVE EFFECT ────────────────────────────────────────────
function resolveEffect(u: Unit, targets: Unit[], center: GridPos | null, pwr: Power) {
  const s        = getStore()
  const mult     = calcDamageMultiplier(u, pwr)
  const shieldDur = pwr._shieldDur ?? 2
  const markDur   = pwr._markDur   ?? 2
  const slowDur   = pwr._slowDur   ?? 2
  const revealDur = pwr._revealDur ?? 3
  const buffDur   = pwr._buffDur   ?? 1
  const leechRate = pwr._leechRate ?? 0.5
  const pushDist  = pwr._pushDist  ?? 2

  switch (pwr.type) {
    case 'damage': case 'dash':
      targets.forEach(t => dealDmg(u, t, Math.round((pwr.damage ?? 30) * mult))); break

    case 'line':
      // BUG 1 FIX: line attacks only hit first enemy in cardinal direction with LoS
      targets.forEach(t => {
        if (rangedCanHit(u, t, s.walls)) dealDmg(u, t, Math.round((pwr.damage ?? 30) * mult))
        else pushLog(`${u.name} shot blocked by wall!`, 'sys')
      }); break

    case 'aoe':
      targets.forEach(t => { if (pwr._noSelfAoe && t.id === u.id) return; let d = Math.round((pwr.damage ?? 20) * mult); if (t.downside.id === 'combustible') d = Math.round(d * 1.75); dealDmg(u, t, d) }); SFX.aoe(); break

    case 'leech': {
      // BUG 1 FIX: ranged leech needs LoS
      const d = Math.round((pwr.damage ?? 30) * mult)
      targets.forEach(t => { if (pwr.range > 1 && !rangedCanHit(u, t, s.walls)) { pushLog(`${u.name} shot blocked!`, 'sys'); return }; dealDmg(u, t, d) })
      const h = Math.min(Math.round(d * leechRate), u.maxHp - u.hp + (pwr._overheal ?? 0))
      if (h > 0) { u.hp += h; pushLog(`${u.name} leeches +${h}`, 'hl'); spawnNum(u.id, `+${h}`, 'heal'); animHeal(u.id); SFX.heal() }; break }

    case 'heal':
      targets.forEach(t => { if (t.downside.id === 'corrupt_heal') { t.statuses.poison = { dur: 2, dmg: 8 }; popSts(t.id, 'CORRUPTED!', '#f43'); pushLog(`${t.name} heal→poison!`, 'sts') } else { const r = applyHeal(u, t, pwr.heal ?? 40); if (r.amount > 0) { pushLog(`${u.name} heals ${t.name} +${r.amount}`, 'hl'); spawnNum(t.id, `+${r.amount}`, 'heal'); animHeal(t.id); SFX.heal() } if (pwr._regenOnCleanse) t.statuses.regen = { dur: 1 } } }); break

    case 'shield':
      u.statuses.shielded = { dur: shieldDur }; if (pwr._reflect) u.statuses.reflect = { dur: shieldDur, val: pwr._reflect }
      pushLog(`${u.name} shields!`, 'sys'); popSts(u.id, 'SHIELDED', 'var(--accent3)'); break

    case 'selfbuff':
      if (pwr.id === 'adrenaline' || pwr.id === 'rally') { u.statuses.hasted = { dur: 1 }; u.statuses.empowered = { dur: buffDur + 1 }; popSts(u.id, 'POWERED UP!', '#fb0') }
      if (pwr.id === 'stabilize') { u.statuses.stabilized = { dur: 1 }; popSts(u.id, 'STABILIZED', 'var(--accent3)') }
      if (pwr.id === 'rewind') { const ph = s.turnStartHP[u.id] ?? u.maxHp; const gain = Math.min(ph, u.maxHp) - u.hp; if (gain > 0) { u.hp = Math.min(ph, u.maxHp); spawnNum(u.id, `+${gain}`, 'heal'); animHeal(u.id); pushLog(`${u.name} rewinds!`, 'hl'); SFX.heal() } }
      if (pwr.applyS?.[0] === 'selfempower') { u.statuses.empowered = { dur: pwr.applyS[1] ?? 2 }; popSts(u.id, 'EMPOWERED!', '#fc0') }; break

    case 'double': break

    case 'push': targets.forEach(t => { dealDmg(u, t, Math.round((pwr.damage ?? 16) * mult)); applyPush(t, u.pos, s.grid, s.walls, pushDist) }); break

    case 'mark': targets.forEach(t => { t.statuses.marked = { dur: markDur }; popSts(t.id, 'MARKED!', '#ff0'); pushLog(`${t.name} marked!`, 'sts') }); break
    case 'slow': targets.forEach(t => { t.statuses.slowed = { dur: slowDur }; popSts(t.id, 'SLOWED!', '#667'); pushLog(`${t.name} slowed!`, 'sts') }); break

    case 'cleanse': targets.forEach(t => { (['poison','burn','stunned','weakened','slowed','confused'] as const).forEach(k => delete t.statuses[k]); popSts(t.id, 'CLEANSED!', 'var(--accent3)'); pushLog(`${t.name} cleansed!`, 'hl'); SFX.heal(); if (pwr._regenOnCleanse) t.statuses.regen = { dur: 1 } }); break

    case 'stealth': u.statuses.invisible = { dur: pwr.name === 'Smoke Screen' ? 2 : 3 }; popSts(u.id, 'INVISIBLE!', 'var(--purple)'); pushLog(`${u.name} vanishes!`, 'sts'); break

    case 'scan':
      if (center) { const sr = (pwr.range ?? 5) + (pwr._rangeBonus ?? 0); s.units.filter(t => t.team === 'enemy' && !isDead(t) && Math.abs(t.pos.r - center.r) <= sr && Math.abs(t.pos.c - center.c) <= sr).forEach(t => { revealUnit(t, revealDur, s.fogReveal); if (pwr._scanStun && !t.statuses.confused) { t.statuses.confused = { dur: 1 }; pushLog(`${t.name} shocked!`, 'sts') } }); for (let r = Math.max(0, center.r - sr); r <= Math.min(GSIZE-1, center.r + sr); r++) for (let c = Math.max(0, center.c - sr); c <= Math.min(GSIZE-1, center.c + sr); c++) s.visibleCells.add(`${r},${c}`); pushLog(`${u.name} scans!`, 'fog-log') }; break

    case 'scan_all': s.units.filter(t => t.team === 'enemy' && !isDead(t)).forEach(t => revealUnit(t, pwr._revealDur ?? 1, s.fogReveal)); pushLog(`${u.name} full radar!`, 'fog-log'); break
    case 'reveal': targets.forEach(t => { revealUnit(t, revealDur, s.fogReveal); t.statuses.marked = { dur: revealDur }; popSts(t.id, 'TRACKED!', '#ff0'); pushLog(`${t.name} tracked!`, 'fog-log') }); break
    case 'teleport': break

    case 'aoe_buff':
      if (pwr.id === 'entropy_field') { s.units.filter(t => !isDead(t)).forEach(t => { const k = applyRandomStatus(t); popSts(t.id, k.toUpperCase() + '!', '#c0f') }); pushLog('ENTROPY FIELD!', 'sts') }
      else { s.units.filter(t => t.team === u.team && !isDead(t)).forEach(t => { t.statuses.hasted = { dur: buffDur }; t.statuses.empowered = { dur: buffDur }; if (pwr._buffHeal) { const h = Math.min(pwr._buffHeal, t.maxHp - t.hp); t.hp += h }; popSts(t.id, 'WAR CRY!', '#fb0') }); pushLog(`${u.name} WAR CRY!`, 'sts') }
      SFX.ability(); break

    default: if (pwr.damage) targets.forEach(t => dealDmg(u, t, Math.round(pwr.damage! * mult)))
  }

  if (pwr.applyS) {
    const [sKey, sDur, sDmg = 8] = pwr.applyS
    if (sKey === 'selfstun') { u.statuses.stunned = { dur: 1 }; popSts(u.id, 'STUNNED!', '#bbb'); pushLog(`${u.name} self-stunned!`, 'sys') }
    else if (sKey !== 'selfempower') targets.forEach(t => { if (!isDead(t)) { (t.statuses as any)[sKey] = { dur: sDur, dmg: sDmg }; popSts(t.id, sKey.toUpperCase() + '!', '#c0f'); pushLog(`${t.name} ${sKey}!`, 'sts'); SFX.status_apply() } })
  }
}

function dealDmg(attacker: Unit, target: Unit, raw: number) {
  if (isDead(target)) return
  const res = applyDamage(attacker, target, raw)
  pushLog(`${attacker.name}→${target.name} -${res.amount}`, 'dmg')
  spawnNum(target.id, `-${res.amount}`, 'dmg'); animHit(target.id)
  if (res.amount >= 45) SFX.hit_heavy(); else SFX.hit()
  if (res.shieldAbsorbed > 0) pushLog(`${target.name} shield absorbs!`, 'sys')
  if (res.soulboundExplode) { pushLog(`${target.name} EXPLODES!`, 'sys'); SFX.death(); getStore().units.filter(t => t.team === attacker.team && !isDead(t)).forEach(t => dealDmg(target, t, 50)) }
  if (res.killed) killUnit(target)
}

function doRandomMove(u: Unit) {
  if (u.downside.id === 'locked_pos') return
  const s = getStore()
  const dirs = [[-1,0],[1,0],[0,-1],[0,1]].sort(() => Math.random() - 0.5)
  for (const [dr, dc] of dirs) {
    const nr = u.pos.r+dr, nc = u.pos.c+dc
    if (nr>=0&&nr<GSIZE&&nc>=0&&nc<GSIZE&&!s.grid[nr]?.[nc]&&!s.walls.has(`${nr},${nc}`)) { moveUnitOnGrid(u,nr,nc,s.grid); pushLog(`${u.name} stumbles!`,'sys'); SFX.move(); break }
  }
}

// ── ENEMY AI ──────────────────────────────────────────────────
function runEnemyTurn(u: Unit) {
  if (isDead(u)) return
  const s     = getStore()
  const alive = s.units.filter(t => t.team === 'player' && !isDead(t))
  if (!alive.length) return

  const action = decideAction(u, alive, s.units, s.grid, s.walls, s.difficulty)

  switch (action.type) {
    case 'skip': pushLog(action.logMsg, 'sys'); break

    case 'selfbuff':
      pushLog(action.logMsg, 'sys')
      if (action.power) resolveEffect(u, [], null, action.power)
      applyBackfire(u); break

    case 'heal':
      pushLog(action.logMsg, 'sys')
      if (action.power && action.targets[0]) resolveEffect(u, action.targets, action.center, action.power); break

    case 'ability':
      if (!action.power) break
      if (u.downside.id === 'delayed_action' && !u.pendingAbility) { u.pendingAbility = { targets: action.targets, center: action.center, power: action.power }; pushLog(`${u.name} charges...`,'sys'); applyBackfire(u); break }
      if (shouldMiss(u, action.power)) { pushLog(`${u.name} MISSES!`,'mss'); SFX.miss(); applyBackfire(u); break }
      breakInvisOnAttack(u); SFX.ability(); pushLog(action.logMsg,'new')
      let pwr = action.power
      if (u._dmgBonus && pwr.damage) pwr = { ...pwr, damage: pwr.damage + u._dmgBonus }
      // BUG 1 FIX: enforce LoS for ranged enemy attacks
      const filteredTargets = (['line','damage','leech'].includes(pwr.type) && pwr.range > 1)
        ? action.targets.filter(t => rangedCanHit(u, t, s.walls))
        : action.targets
      if (filteredTargets.length > 0 || !['line','damage','leech'].includes(pwr.type)) {
        resolveEffect(u, filteredTargets, action.center, pwr)
      } else {
        pushLog(`${u.name} shot blocked by wall!`, 'sys')
      }
      applyBackfire(u)
      if (applyStunAfter(u)) { pushLog(`${u.name} stunned after!`,'sys'); popSts(u.id,'STUNNED!','#bbb') }; break

    case 'punch':
      if (action.targets[0]) {
        const t = action.targets[0]; let dmg=12
        if (t.statuses.marked) dmg=Math.floor(dmg*1.5); if (t.downside.id==='glass_body') dmg=Math.floor(dmg*1.5)
        if (t.statuses.shielded) { dmg=Math.floor(dmg*.5); delete t.statuses.shielded }
        dmg=Math.max(1,dmg); t.hp=Math.max(0,t.hp-dmg)
        pushLog(action.logMsg,'punch'); spawnNum(t.id,`-${dmg}`,'dmg'); animHit(t.id); SFX.punch()
        if (isDead(t)) { syncUnits(s.units); renderGrid(); killUnit(t); return }
      }; break
  }

  syncUnits(s.units); syncVisible(); renderGrid()
}