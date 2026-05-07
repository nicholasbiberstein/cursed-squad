import React, { useState, useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { useStore } from '@store'
import { save } from '@systems/SaveManager'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, SYN_TAGS } from '@data/rarity'
import {
  getTutorialState, saveTutorialState, markTutorialComplete,
  markTutorialSkipped, markRewardGiven, TutorialStep,
} from './TutorialManager'
import { buildTutorialMap, buildTutorialUnits, TUTORIAL_GRID_SIZE } from './TutorialBattle'
import { buildTurnOrder, checkWinLose } from '@systems/TurnManager'
import { computeVisibility } from '@systems/VisibilityEngine'
import { moveUnitOnGrid } from '@systems/MapBuilder'
import { applyDamage } from '@systems/CombatEngine'
import { getDiffConfig } from '@data/difficulty'
import type { Unit } from '@data/types'
import { SFX } from '@ui/AudioEngine'

// ============================================================
// TUTORIAL SCREEN
// 6-step guided introduction to Cursed Squad.
// Steps 1-4 are forced. Step 5 (battle) is skippable.
// Reward: +150 coins + 2 diamonds on completion.
// ============================================================

const CELL = 52  // Bigger cells for 9x9 tutorial grid

const TUTORIAL_REWARD = { coins: 150, diamonds: 2 }

// ── Shared styles ─────────────────────────────────────────────
const overlay: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
  display: 'flex', flexDirection: 'column', alignItems: 'center',
  justifyContent: 'center', zIndex: 2000, padding: 24,
  pointerEvents: 'all', overflowY: 'auto',
}
const card: React.CSSProperties = {
  background: 'var(--panel)', border: '2px solid var(--border)',
  padding: '20px 24px', maxWidth: 560, width: '100%',
}
const h1Style: React.CSSProperties = {
  fontFamily: "'Bebas Neue', sans-serif", fontSize: 38,
  color: 'var(--accent2)', letterSpacing: '0.05em', marginBottom: 6,
}
const bodyStyle: React.CSSProperties = {
  fontSize: 12, color: 'var(--muted)', lineHeight: 1.75,
}
const stepDot = (active: boolean, done: boolean): React.CSSProperties => ({
  width: 8, height: 8, borderRadius: '50%',
  background: done ? 'var(--accent3)' : active ? 'var(--accent2)' : 'var(--border)',
  transition: 'background 0.2s',
})

// ── Step indicator ────────────────────────────────────────────
function StepDots({ current, total }: { current: number; total: number }) {
  return (
    <div style={{ display: 'flex', gap: 6, justifyContent: 'center', marginBottom: 18 }}>
      {Array.from({ length: total }).map((_, i) => (
        <div key={i} style={stepDot(i === current, i < current)} />
      ))}
    </div>
  )
}

// ── Forge card preview ────────────────────────────────────────
function ForgeCardPreview({ powerId, curseId }: { powerId: string; curseId: string }) {
  const power = ALL_POWERS.find(p => p.id === powerId)
  const curse = ALL_CURSES.find(c => c.id === curseId)
  if (!power || !curse) return null
  const rc = rarColor(power.rarity)
  return (
    <div style={{ border: `2px solid ${rc}`, background: 'var(--panel2)', padding: 16, maxWidth: 280, margin: '0 auto' }}>
      {/* Power half */}
      <div style={{ paddingBottom: 10, marginBottom: 10, borderBottom: '1px solid var(--border)' }}>
        <div style={{ fontSize: 8, color: rc, letterSpacing: '0.14em', fontFamily: "'Bebas Neue', sans-serif" }}>
          {power.rarity.toUpperCase()} · {power.cat.toUpperCase()}
        </div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)', marginTop: 2 }}>
          {power.icon} {power.name}
        </div>
        <div style={{ fontSize: 10, color: 'var(--text)', marginTop: 4, lineHeight: 1.5 }}>
          {power.desc}
        </div>
        {power.damage && (
          <div style={{ fontSize: 10, color: '#ff8080', marginTop: 4 }}>💥 {power.damage} dmg · range {power.range}</div>
        )}
      </div>
      {/* Curse half */}
      <div>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent)' }}>
          {curse.icon} {curse.name}
        </div>
        <div style={{ fontSize: 10, color: '#ff8080', marginTop: 4, lineHeight: 1.5 }}>
          {curse.desc}
        </div>
        <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
          {curse.synergy.map(k => (
            <span key={k} className={`syn-tag ${SYN_TAGS[k]?.cls ?? ''}`} style={{ fontSize: 7 }}>
              {SYN_TAGS[k]?.label ?? k}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Mini battle renderer ──────────────────────────────────────
function TutorialBattleCanvas({
  units, grid, walls, covers, visibleCells, selectedId, phase, highlightCells,
  onCellClick,
}: {
  units: Unit[]; grid: (string|null)[][]; walls: Set<string>; covers: Set<string>
  visibleCells: Set<string>; selectedId: string | null; phase: string
  highlightCells: Set<string>; onCellClick: (r: number, c: number) => void
}) {
  const size = TUTORIAL_GRID_SIZE
  const cells = []
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      const key  = `${r},${c}`
      const isWall   = walls.has(key)
      const isCover  = covers.has(key)
      const isFog    = !visibleCells.has(key) && !isWall
      const isHL     = highlightCells.has(key)
      const uid      = grid[r]?.[c]
      const unit     = uid ? units.find(u => u.id === uid) : null
      const isSel    = unit?.id === selectedId

      let bg = 'transparent'
      let border = 'rgba(255,255,255,0.03)'
      if (isWall)  { bg = '#111120'; border = '#1c1c2c' }
      if (isCover) { bg = 'rgba(255,136,0,0.08)'; border = 'rgba(255,136,0,0.2)' }
      if (isFog && !isWall) bg = 'rgba(4,4,10,0.9)'
      if (isHL)    { bg = 'rgba(60,143,255,0.2)'; border = 'rgba(60,143,255,0.6)' }

      cells.push(
        <div
          key={key}
          onClick={() => !isWall && onCellClick(r, c)}
          style={{
            width: CELL, height: CELL,
            background: bg, border: `1px solid ${border}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            position: 'relative', cursor: isHL ? 'pointer' : 'default',
            boxSizing: 'border-box',
          }}
        >
          {isWall && (
            <div style={{ position: 'absolute', inset: 3, background: 'repeating-linear-gradient(45deg,#191927,#191927 3px,transparent 3px,transparent 8px)', opacity: 0.7 }} />
          )}
          {unit && !isFog && (
            <div style={{
              width: 38, height: 38, display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              background: unit.team === 'player' ? 'rgba(60,143,255,0.2)' : 'rgba(255,60,60,0.2)',
              border: `2px solid ${isSel ? '#ffb800' : unit.team === 'player' ? '#3c8fff' : '#ff3c3c'}`,
              boxShadow: isSel ? '0 0 8px rgba(255,184,0,0.4)' : 'none',
              transition: 'all 0.15s', zIndex: 2,
            }}>
              <div style={{ fontSize: 14, lineHeight: 1 }}>{unit.icon}</div>
              <div style={{ fontSize: 7, color: '#3cffb4', lineHeight: 1 }}>{unit.hp}</div>
            </div>
          )}
        </div>
      )
    }
  }

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: `repeat(${size}, ${CELL}px)`,
      gridTemplateRows:    `repeat(${size}, ${CELL}px)`,
      border: '1px solid var(--border)',
    }}>
      {cells}
    </div>
  )
}

// ── MAIN TUTORIAL COMPONENT ───────────────────────────────────
export default function TutorialScreen({ onComplete }: { onComplete: () => void }) {
  const { setScreen } = useStore()

  // Which of the 6 steps we're on (0-indexed)
  const [stepIdx, setStepIdx] = useState(0)
  const [fadeIn,  setFadeIn]  = useState(false)

  // Battle state
  const [battleUnits,    setBattleUnits]    = useState<Unit[]>([])
  const [battleGrid,     setBattleGrid]     = useState<(string|null)[][]>([])
  const [battleWalls,    setBattleWalls]    = useState<Set<string>>(new Set())
  const [battleCovers,   setBattleCovers]   = useState<Set<string>>(new Set())
  const [visibleCells,   setVisibleCells]   = useState<Set<string>>(new Set())
  const [selectedId,     setSelectedId]     = useState<string|null>(null)
  const [battlePhase,    setBattlePhase]    = useState<'player'|'enemy'|'done'>('player')
  const [unitActs,       setUnitActs]       = useState<Record<string,{moved:boolean;acted:boolean}>>({})
  const [highlightCells, setHighlightCells] = useState<Set<string>>(new Set())
  const [battlePhaseUI,  setBattlePhaseUI]  = useState<string>('idle')
  const [battleLog,      setBattleLog]      = useState<string[]>([])
  const [battleResult,   setBattleResult]   = useState<'win'|'lose'|null>(null)
  const [tooltipMsg,     setTooltipMsg]     = useState<string>('')

  // Tutorial battle hints progress
  const [hintStep, setHintStep] = useState(0)
  const HINTS = [
    '👆 Click a unit on the left to SELECT it — it will glow gold',
    '🔵 Click MOVE, then click a blue tile to move your unit',
    '⚡ Click the ABILITY button, then click an enemy to attack',
    '⏹ Click END TURN when you\'re done — enemies will react',
    '🎯 Keep fighting! Defeat both enemies to win.',
  ]

  useEffect(() => {
    setTimeout(() => setFadeIn(true), 50)
  }, [])

  function nextStep() {
    SFX.click()
    setFadeIn(false)
    setTimeout(() => { setStepIdx(s => s + 1); setFadeIn(true) }, 200)
  }

  function handleSkip() {
    SFX.click()
    markTutorialSkipped()
    giveReward()
    onComplete()
  }

  function giveReward() {
    const state = getTutorialState()
    if (state.rewardGiven) return
    save.coins    += TUTORIAL_REWARD.coins
    save.diamonds += TUTORIAL_REWARD.diamonds
    save.persistCoins()
    useStore.setState({ coins: save.coins, diamonds: save.diamonds })
    markRewardGiven()
  }

  // ── Init tutorial battle ──────────────────────────────────
  function initTutorialBattle() {
    const { grid, walls, covers } = buildTutorialMap()
    const units = buildTutorialUnits()
    // Place units manually
    units.forEach(u => { grid[u.pos.r][u.pos.c] = u.id })
    const fogReveal = new Map<string,number>()
    const visible   = computeVisibility(units, walls, fogReveal)
    const acts: Record<string,{moved:boolean;acted:boolean}> = {}
    units.filter(u => u.team === 'player').forEach(u => { acts[u.id] = { moved: false, acted: false } })

    setBattleUnits(units)
    setBattleGrid(grid)
    setBattleWalls(walls)
    setBattleCovers(covers)
    setVisibleCells(visible)
    setUnitActs(acts)
    setBattlePhase('player')
    setBattlePhaseUI('idle')
    setBattleResult(null)
    setBattleLog([])
    setSelectedId(null)
    setHintStep(0)
    setTooltipMsg(HINTS[0])
  }

  // ── Select unit ───────────────────────────────────────────
  function handleSelectUnit(unitId: string) {
    const u = battleUnits.find(x => x.id === unitId)
    if (!u || u.team !== 'player' || u.hp <= 0 || battlePhase !== 'player') return
    SFX.click()
    setSelectedId(unitId)
    setBattlePhaseUI('idle')
    setHighlightCells(new Set())
    if (hintStep === 0) { setHintStep(1); setTooltipMsg(HINTS[1]) }
  }

  // ── Move ──────────────────────────────────────────────────
  function startMove() {
    if (!selectedId || battlePhase !== 'player') return
    const u = battleUnits.find(x => x.id === selectedId)
    if (!u || unitActs[u.id]?.moved) return
    SFX.click()
    setBattlePhaseUI('move')
    // BFS highlights
    const range = 3
    const hl    = new Set<string>()
    const queue = [{ r: u.pos.r, c: u.pos.c, steps: 0 }]
    const vis   = new Set([`${u.pos.r},${u.pos.c}`])
    while (queue.length) {
      const { r, c, steps } = queue.shift()!
      if (steps > 0 && !battleGrid[r]?.[c] && !battleWalls.has(`${r},${c}`)) hl.add(`${r},${c}`)
      if (steps >= range) continue
      for (const [dr,dc] of [[-1,0],[1,0],[0,-1],[0,1]]) {
        const nr=r+dr,nc=c+dc,nk=`${nr},${nc}`
        if (nr<0||nr>=TUTORIAL_GRID_SIZE||nc<0||nc>=TUTORIAL_GRID_SIZE||vis.has(nk)||battleWalls.has(nk)||battleGrid[nr]?.[nc]) continue
        vis.add(nk); queue.push({ r:nr,c:nc,steps:steps+1 })
      }
    }
    setHighlightCells(hl)
  }

  function startAttack() {
    if (!selectedId || battlePhase !== 'player') return
    const u = battleUnits.find(x => x.id === selectedId)
    if (!u || unitActs[u.id]?.acted) return
    SFX.click()
    setBattlePhaseUI('attack')
    // Highlight enemies in range
    const range = u.power.range ?? 1
    const hl    = new Set<string>()
    battleUnits.filter(t => t.team === 'enemy' && t.hp > 0).forEach(t => {
      const dist = Math.abs(t.pos.r - u.pos.r) + Math.abs(t.pos.c - u.pos.c)
      if (dist <= range) hl.add(`${t.pos.r},${t.pos.c}`)
    })
    setHighlightCells(hl)
    if (hintStep <= 1) { setHintStep(2); setTooltipMsg(HINTS[2]) }
  }

  // ── Cell click ────────────────────────────────────────────
  function handleCellClick(r: number, c: number) {
    const u = selectedId ? battleUnits.find(x => x.id === selectedId) : null

    // Click friendly unit to select
    const clickedUnit = battleUnits.find(x => x.pos.r===r && x.pos.c===c && x.hp>0)
    if (clickedUnit?.team === 'player') { handleSelectUnit(clickedUnit.id); return }

    if (!u || battlePhase !== 'player') return

    if (battlePhaseUI === 'move') {
      if (!highlightCells.has(`${r},${c}`)) return
      const newGrid = battleGrid.map(row => [...row])
      const newUnits = battleUnits.map(x => ({ ...x }))
      const mu = newUnits.find(x => x.id === u.id)!
      newGrid[mu.pos.r][mu.pos.c] = null
      mu.pos = { r, c }
      newGrid[r][c] = mu.id
      setUnitActs(a => ({ ...a, [u.id]: { ...a[u.id], moved: true } }))
      setBattleGrid(newGrid)
      setBattleUnits(newUnits)
      setBattlePhaseUI('idle')
      setHighlightCells(new Set())
      SFX.move()
      const newVis = computeVisibility(newUnits, battleWalls, new Map())
      setVisibleCells(newVis)
      if (hintStep <= 1) { setHintStep(2); setTooltipMsg(HINTS[2]) }
    }

    if (battlePhaseUI === 'attack') {
      const target = battleUnits.find(t => t.pos.r===r && t.pos.c===c && t.hp>0 && t.team==='enemy')
      if (!target || !highlightCells.has(`${r},${c}`)) return

      const newUnits = battleUnits.map(x => ({ ...x }))
      const attacker = newUnits.find(x => x.id === u.id)!
      const tgt      = newUnits.find(x => x.id === target.id)!
      const dmg      = Math.max(1, (u.power.damage ?? 30) - Math.floor(Math.random() * 6))
      tgt.hp         = Math.max(0, tgt.hp - dmg)
      SFX.hit()

      addLog(`${attacker.name} hits ${tgt.name} for ${dmg} damage!`)
      setUnitActs(a => ({ ...a, [u.id]: { ...a[u.id], acted: true } }))
      setBattleUnits(newUnits)
      setBattlePhaseUI('idle')
      setHighlightCells(new Set())
      if (hintStep <= 2) { setHintStep(3); setTooltipMsg(HINTS[3]) }

      // Check win
      if (newUnits.filter(x => x.team==='enemy' && x.hp>0).length === 0) {
        setBattleResult('win'); setBattlePhase('done'); return
      }

      // Update grid for dead enemies
      const newGrid = battleGrid.map(row => [...row])
      if (tgt.hp <= 0) newGrid[tgt.pos.r][tgt.pos.c] = null
      setBattleGrid(newGrid)
    }
  }

  function addLog(msg: string) {
    setBattleLog(l => [...l.slice(-8), msg])
  }

  // ── End player turn → run enemies ─────────────────────────
  function handleEndTurn() {
    if (battlePhase !== 'player') return
    SFX.click()
    setBattlePhase('enemy')
    setBattlePhaseUI('enemy')
    setHighlightCells(new Set())
    setSelectedId(null)
    addLog('— Enemy Phase —')

    // Simple AI: each enemy moves toward nearest player and attacks if adjacent
    setTimeout(() => {
      let units = [...battleUnits.map(u => ({ ...u }))]
      let grid  = battleGrid.map(r => [...r])

      const playerAlive = units.filter(u => u.team==='player' && u.hp>0)
      const enemies     = units.filter(u => u.team==='enemy'  && u.hp>0)

      enemies.forEach(enemy => {
        const target = playerAlive.sort((a,b) =>
          Math.abs(a.pos.r-enemy.pos.r)+Math.abs(a.pos.c-enemy.pos.c) -
          Math.abs(b.pos.r-enemy.pos.r)+Math.abs(b.pos.c-enemy.pos.c)
        )[0]
        if (!target) return

        // Move toward player
        const dr = Math.sign(target.pos.r - enemy.pos.r)
        const dc = Math.sign(target.pos.c - enemy.pos.c)
        const e  = units.find(u => u.id === enemy.id)!
        const candidates = [[dr,0],[0,dc],[dr,dc]].filter(([r,c]) => r!==0||c!==0)

        for (const [mr, mc] of candidates) {
          const nr=e.pos.r+mr, nc=e.pos.c+mc
          if (nr<0||nr>=TUTORIAL_GRID_SIZE||nc<0||nc>=TUTORIAL_GRID_SIZE) continue
          if (grid[nr][nc] || battleWalls.has(`${nr},${nc}`)) continue
          grid[e.pos.r][e.pos.c] = null
          e.pos = { r:nr, c:nc }
          grid[nr][nc] = e.id
          break
        }

        // Attack if adjacent
        const t = units.find(u => u.id === target.id)!
        const dist = Math.abs(e.pos.r-t.pos.r)+Math.abs(e.pos.c-t.pos.c)
        if (dist <= 1) {
          const dmg = Math.max(1, (e.power.damage ?? 20) - Math.floor(Math.random() * 8))
          t.hp = Math.max(0, t.hp - dmg)
          addLog(`${e.name} strikes ${t.name} for ${dmg} damage!`)
          SFX.hit()
        }
      })

      setBattleUnits(units)
      setBattleGrid(grid)
      const newVis = computeVisibility(units, battleWalls, new Map())
      setVisibleCells(newVis)

      if (units.filter(u => u.team==='player' && u.hp>0).length === 0) {
        setBattleResult('lose'); setBattlePhase('done'); return
      }

      // Reset player action budgets
      const acts: Record<string,{moved:boolean;acted:boolean}> = {}
      units.filter(u => u.team==='player' && u.hp>0).forEach(u => { acts[u.id] = { moved:false, acted:false } })
      setUnitActs(acts)
      setBattlePhase('player')
      setBattlePhaseUI('idle')
      setHintStep(h => Math.max(h, 4))
      setTooltipMsg(HINTS[4])
      addLog('— Your Turn —')
      SFX.turn_start()
    }, 1200)
  }

  // ── Finish tutorial ────────────────────────────────────────
  function completeTutorial() {
    markTutorialComplete()
    giveReward()
    SFX.victory()
    onComplete()
  }

  const selectedUnit = selectedId ? battleUnits.find(u => u.id === selectedId) : null
  const selActs      = selectedId ? (unitActs[selectedId] ?? { moved:false, acted:false }) : null
  const enemiesAlive = battleUnits.filter(u => u.team==='enemy' && u.hp>0).length
  const friendsAlive = battleUnits.filter(u => u.team==='player' && u.hp>0).length

  // ============================================================
  // RENDER STEPS
  // ============================================================

  const totalSteps = 6

  // ── STEP 0: Welcome ──────────────────────────────────────
  if (stepIdx === 0) return (
    <div style={{ ...overlay, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s' }}>
      <div style={{ ...card, textAlign: 'center', gap: 0, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
        <StepDots current={0} total={totalSteps} />

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 56, lineHeight: 0.9, background: 'linear-gradient(135deg,#ff3c3c,#ffb800)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', marginBottom: 8 }}>
          CURSED<br />SQUAD
        </div>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent3)', letterSpacing: '0.2em', marginBottom: 20 }}>
          WELCOME, COMMANDER
        </div>

        <div style={{ ...bodyStyle, textAlign: 'left', marginBottom: 20 }}>
          Before you head into battle, here's what you need to know:
        </div>

        {[
          ['⚡', 'POWER + CURSE', 'Every unit has a Power (what they do) and a Curse (the permanent price they pay for it). You choose the curse yourself when you forge a card.'],
          ['🧑‍🤝‍🧑', 'BUILD A SQUAD', 'You field 5 units per battle. Each unit uses one of your forged cards. Pick the right combination and the curses become strengths.'],
          ['🏆', 'WIN TO PROGRESS', 'Winning battles earns coins to buy more powers. Complete campaigns to earn diamonds. Events unlock mythical powers that can\'t be bought.'],
        ].map(([icon, title, desc]) => (
          <div key={title} style={{ display: 'flex', gap: 14, marginBottom: 14, textAlign: 'left' }}>
            <div style={{ fontSize: 24, flexShrink: 0, marginTop: 2 }}>{icon}</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--accent2)', marginBottom: 2 }}>{title}</div>
              <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          </div>
        ))}

        <div style={{ display: 'flex', gap: 10, marginTop: 6, width: '100%', justifyContent: 'center' }}>
          <button className="btn btn-primary" style={{ fontSize: 18, padding: '10px 32px' }} onClick={nextStep}>
            START TUTORIAL →
          </button>
        </div>

        <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 10 }}>
          Quick tutorial — about 3 minutes. You'll earn 🪙150 coins + 💎2 diamonds on completion.
        </div>
      </div>
    </div>
  )

  // ── STEP 1: Forge Explained ───────────────────────────────
  if (stepIdx === 1) return (
    <div style={{ ...overlay, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <StepDots current={1} total={totalSteps} />
        <div style={h1Style}>THE FORGED CARD</div>
        <div style={bodyStyle}>
          This is the core of Cursed Squad. Every card you own is a <span style={{ color: 'var(--accent2)' }}>Power bound to a Curse</span>. You chose that curse — it's permanent and strategic, not a penalty.
        </div>

        <ForgeCardPreview powerId="strike" curseId="health_drain" />

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 4 }}>
          <div style={{ background: 'rgba(60,143,255,0.08)', border: '1px solid rgba(60,143,255,0.3)', padding: 12 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--accent2)', marginBottom: 4 }}>⚡ THE POWER</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
              What your unit does in battle. Strike deals 32 damage to an adjacent enemy. Every power has a range, type, and effect.
            </div>
          </div>
          <div style={{ background: 'rgba(255,60,60,0.06)', border: '1px solid rgba(255,60,60,0.25)', padding: 12 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--accent)', marginBottom: 4 }}>💀 THE CURSE</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
              The permanent downside. Health Drain costs 8 HP every turn. Pick curses that match your playstyle — aggressive players can lean into the drain.
            </div>
          </div>
        </div>

        <div style={{ background: 'rgba(60,255,180,0.06)', border: '1px solid rgba(60,255,180,0.2)', padding: 10, fontSize: 10, color: 'var(--accent3)', lineHeight: 1.6 }}>
          💡 In the Shop you buy powers, then immediately choose 1 of 3 curses to bind. You can reroll curses later in Collection for 💎 diamonds.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={nextStep}>GOT IT →</button>
        </div>
      </div>
    </div>
  )

  // ── STEP 2: Build Explained ───────────────────────────────
  if (stepIdx === 2) return (
    <div style={{ ...overlay, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <StepDots current={2} total={totalSteps} />
        <div style={h1Style}>BUILDING YOUR SQUAD</div>
        <div style={bodyStyle}>
          Before every battle you build a squad of <span style={{ color: 'var(--accent2)' }}>5 units</span>. Each unit uses one of your forged cards. You start with 5 pre-made starter cards — enough to play immediately.
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            ['01', '⚔ Strike + 🩸 Health Drain', 'Melee damage — takes 8 HP per turn'],
            ['02', '🎯 Sniper Shot + 🎲 Unstable Aim', 'Long range line attack — 25% miss chance'],
            ['03', '💨 Short Dash + ⏳ Delayed Action', 'Mobile striker — ability fires next turn'],
            ['04', '🛡 Fortify + 🐢 Slow Reaction', 'Shield user — always acts last'],
            ['05', '📡 Scout Ping + 🙈 Blind', 'Radar unit — reduced vision range'],
          ].map(([slot, name, note]) => (
            <div key={slot} style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel2)', padding: '8px 12px', border: '1px solid var(--border)' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--border)', minWidth: 28 }}>{slot}</div>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--accent2)' }}>{name}</div>
                <div style={{ fontSize: 9, color: 'var(--muted)' }}>{note}</div>
              </div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)', padding: 10, fontSize: 10, color: 'var(--accent2)', lineHeight: 1.6 }}>
          💡 Real battles are <strong>5v5 on a 15×15 grid</strong> with full fog of war. Your tutorial battle will be a <strong>2v2 on a smaller grid</strong> to keep things simple.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button className="btn btn-primary" onClick={nextStep}>NEXT →</button>
        </div>
      </div>
    </div>
  )

  // ── STEP 3: Battle Basics ─────────────────────────────────
  if (stepIdx === 3) return (
    <div style={{ ...overlay, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s' }}>
      <div style={{ ...card, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <StepDots current={3} total={totalSteps} />
        <div style={h1Style}>HOW BATTLE WORKS</div>
        <div style={bodyStyle}>
          Battle is <span style={{ color: 'var(--accent2)' }}>turn-based and squad-wide</span>. All your units act before the enemies respond.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {[
            { color: 'var(--blue)',    border: 'rgba(60,143,255,0.3)',  icon: '🔵', label: 'MOVE', desc: 'Select a unit, click MOVE, then click a blue tile. Each unit moves once per round. Walls and other units block movement.' },
            { color: 'var(--orange)',  border: 'rgba(255,136,0,0.3)',   icon: '👊', label: 'PUNCH', desc: 'Free 12-damage attack on any adjacent enemy. Does not use your ability action. Good for saving ability charges.' },
            { color: 'var(--accent2)', border: 'rgba(255,184,0,0.3)',   icon: '⚡', label: 'ABILITY', desc: 'Your unit\'s power. Each unit can use it once per round. This is your main damage source. Curses apply here.' },
            { color: 'var(--accent)',  border: 'rgba(255,60,60,0.3)',   icon: '⏹', label: 'END TURN', desc: 'Ends your entire player phase. All enemies then act at once. You can move and act with all 5 units before ending.' },
          ].map(({ color, border, icon, label, desc }) => (
            <div key={label} style={{ background: 'var(--panel2)', border: `1px solid ${border}`, padding: 12 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color, marginBottom: 5 }}>
                {icon} {label}
              </div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>{desc}</div>
            </div>
          ))}
        </div>

        <div style={{ background: 'rgba(192,60,255,0.06)', border: '1px solid rgba(192,60,255,0.2)', padding: 10, fontSize: 10, color: 'var(--purple)', lineHeight: 1.6 }}>
          👻 Fog of War: you can only see tiles your units can see. Enemies in fog are hidden until revealed by your vision range or Scout Ping.
        </div>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            className="btn btn-primary"
            style={{ fontSize: 18, padding: '10px 28px' }}
            onClick={() => { initTutorialBattle(); nextStep() }}
          >
            INTO BATTLE →
          </button>
        </div>
      </div>
    </div>
  )

  // ── STEP 4: Tutorial Battle ───────────────────────────────
  if (stepIdx === 4) return (
    <div style={{ ...overlay, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s', justifyContent: 'flex-start', paddingTop: 20 }}>

      {/* Battle result overlay */}
      {battleResult && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, zIndex: 100 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 64, color: battleResult==='win' ? 'var(--accent3)' : 'var(--accent)', filter: `drop-shadow(0 0 24px ${battleResult==='win'?'rgba(60,255,180,0.5)':'rgba(255,60,60,0.5)'})` }}>
            {battleResult === 'win' ? 'VICTORY!' : 'DEFEATED'}
          </div>
          {battleResult === 'win' ? (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', maxWidth: 360, textAlign: 'center', lineHeight: 1.7 }}>
                You've learned the basics. Real battles are 5v5 with full fog of war, curses in play, and AI with three personalities. Good luck, Commander.
              </div>
              <button className="btn btn-confirm" style={{ fontSize: 18, padding: '12px 36px' }} onClick={nextStep}>
                SEE YOUR REWARD →
              </button>
            </>
          ) : (
            <>
              <div style={{ fontSize: 12, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.7 }}>
                Curses are tough at first. Use your ability and end your turn strategically.
              </div>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="btn btn-primary" onClick={() => { initTutorialBattle(); setBattleResult(null) }}>TRY AGAIN</button>
                <button className="btn btn-secondary" onClick={nextStep}>SKIP TO REWARD</button>
              </div>
            </>
          )}
        </div>
      )}

      {/* Tutorial battle UI */}
      <StepDots current={4} total={totalSteps} />

      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)', letterSpacing: '0.1em', marginBottom: 6, textAlign: 'center' }}>
        ⚔ TUTORIAL BATTLE — 2v2
      </div>

      {/* Hint tooltip */}
      <div style={{ background: 'rgba(60,255,180,0.08)', border: '1px solid rgba(60,255,180,0.3)', borderLeft: '3px solid var(--accent3)', padding: '8px 16px', maxWidth: 500, width: '100%', marginBottom: 10, fontSize: 11, color: 'var(--accent3)', lineHeight: 1.5, textAlign: 'center' }}>
        {tooltipMsg}
      </div>

      <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start', flexWrap: 'wrap', justifyContent: 'center' }}>

        {/* Left panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 2 }}>YOUR UNITS</div>
          {battleUnits.filter(u => u.team==='player').map(u => {
            const acts = unitActs[u.id] ?? { moved:false, acted:false }
            const isSel = u.id === selectedId
            return (
              <div key={u.id} onClick={() => handleSelectUnit(u.id)} style={{ background: 'var(--panel)', border: `2px solid ${isSel?'var(--accent2)':'var(--blue)'}`, padding: '7px 9px', cursor: 'pointer', opacity: u.hp<=0?0.3:1 }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--blue)' }}>{u.icon} {u.name}</div>
                <div style={{ background: '#0d0d17', height: 4, margin: '3px 0' }}>
                  <div style={{ height: '100%', background: 'var(--accent3)', width: `${Math.max(0,(u.hp/u.maxHp)*100)}%`, transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: 8, color: 'var(--muted)' }}>{u.hp}/{u.maxHp}</div>
                <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
                  <span style={{ fontSize: 6, padding: '1px 3px', border: `1px solid ${acts.moved?'var(--muted)':'var(--blue)'}`, color: acts.moved?'var(--muted)':'var(--blue)', opacity: acts.moved?0.4:1 }}>{acts.moved?'✓MOV':'MOV'}</span>
                  <span style={{ fontSize: 6, padding: '1px 3px', border: `1px solid ${acts.acted?'var(--muted)':'var(--accent2)'}`, color: acts.acted?'var(--muted)':'var(--accent2)', opacity: acts.acted?0.4:1 }}>{acts.acted?'✓ACT':'ACT'}</span>
                </div>
              </div>
            )
          })}
        </div>

        {/* Grid */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
          <TutorialBattleCanvas
            units={battleUnits} grid={battleGrid} walls={battleWalls}
            covers={battleCovers} visibleCells={visibleCells}
            selectedId={selectedId} phase={battlePhaseUI}
            highlightCells={highlightCells} onCellClick={handleCellClick}
          />

          {/* Action bar */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '8px 12px', display: 'flex', gap: 8, alignItems: 'center', width: '100%', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, fontSize: 9, color: 'var(--muted)' }}>
              {battlePhase === 'enemy' ? '⏳ Enemy acting...' : selectedUnit ? `${selectedUnit.icon} ${selectedUnit.name} selected` : 'Select a unit'}
            </div>
            <button className="btn-act ba-move" disabled={!selectedId||battlePhase!=='player'||!!selActs?.moved} onClick={startMove} style={{ fontSize: 12 }}>MOVE</button>
            <button className="btn-act ba-abil" disabled={!selectedId||battlePhase!=='player'||!!selActs?.acted} onClick={startAttack} style={{ fontSize: 12 }}>
              {selectedUnit?.power.name?.toUpperCase() ?? 'ABILITY'}
            </button>
            <button
              className="btn-act ba-end"
              disabled={battlePhase!=='player'}
              onClick={handleEndTurn}
              style={{ fontSize: 12 }}
            >
              END TURN
            </button>
          </div>

          {/* Log */}
          <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '4px 8px', width: '100%', fontSize: 8, color: 'var(--muted)', maxHeight: 60, overflowY: 'auto', lineHeight: 1.8 }}>
            {battleLog.map((l, i) => <div key={i}>› {l}</div>)}
          </div>
        </div>

        {/* Right panel */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, width: 130 }}>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 2 }}>ENEMIES</div>
          {battleUnits.filter(u => u.team==='enemy').map(u => (
            <div key={u.id} style={{ background: 'var(--panel)', border: '2px solid var(--accent)', padding: '7px 9px', opacity: u.hp<=0?0.3:1 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--accent)' }}>{u.icon} {u.name}</div>
              <div style={{ background: '#0d0d17', height: 4, margin: '3px 0' }}>
                <div style={{ height: '100%', background: 'var(--accent)', width: `${Math.max(0,(u.hp/u.maxHp)*100)}%`, transition: 'width 0.3s' }} />
              </div>
              <div style={{ fontSize: 8, color: 'var(--muted)' }}>{u.hp<=0?'✝ FALLEN':`${u.hp}/${u.maxHp}`}</div>
              <div style={{ fontSize: 8, color: 'var(--accent2)', marginTop: 2 }}>{u.power.icon} {u.power.name}</div>
              <div style={{ fontSize: 7, color: 'var(--accent)' }}>{u.downside.icon} {u.downside.name}</div>
            </div>
          ))}
        </div>
      </div>

      <button className="btn btn-secondary" style={{ marginTop: 12, fontSize: 10 }} onClick={() => { markTutorialSkipped(); giveReward(); onComplete() }}>
        Skip tutorial — I know how to play
      </button>
    </div>
  )

  // ── STEP 5: Complete ──────────────────────────────────────
  if (stepIdx === 5) return (
    <div style={{ ...overlay, opacity: fadeIn ? 1 : 0, transition: 'opacity 0.3s' }}>
      <div style={{ ...card, textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14 }}>
        <StepDots current={5} total={totalSteps} />

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 48, color: 'var(--accent3)', filter: 'drop-shadow(0 0 20px rgba(60,255,180,0.4))', lineHeight: 1 }}>
          YOU'RE READY,<br />COMMANDER
        </div>

        <div style={{ ...bodyStyle, maxWidth: 420 }}>
          You know the basics. Now it's time to build your real squad and take on the battlefield.
        </div>

        {/* Reward */}
        <div style={{ background: 'var(--panel2)', border: '2px solid var(--accent2)', padding: '14px 28px', display: 'flex', gap: 24, justifyContent: 'center', alignItems: 'center' }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>🪙</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent2)' }}>+{TUTORIAL_REWARD.coins}</div>
            <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>COINS</div>
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 28 }}>💎</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent2)' }}>+{TUTORIAL_REWARD.diamonds}</div>
            <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>DIAMONDS</div>
          </div>
        </div>

        {/* What's next */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, width: '100%', maxWidth: 400, textAlign: 'left' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 4 }}>WHAT'S WAITING FOR YOU</div>
          {[
            ['🛒', 'SHOP', '40+ powers across 5 rarity tiers — Common to Mythical'],
            ['📁', 'COLLECTION', 'Reroll curses and refine cards to sharpen your builds'],
            ['🏕', 'CAMPAIGN', '3-wave escalating battles — win all 3 for the Legend reward'],
            ['🔮', 'EVENTS', 'Coming soon — limited time modes with exclusive Mythical powers'],
            ['⚔', 'MULTIPLAYER', 'Coming soon — ranked PvP with skill-based matchmaking'],
          ].map(([icon, label, desc]) => (
            <div key={label} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
              <span style={{ fontSize: 16, flexShrink: 0 }}>{icon}</span>
              <div>
                <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--accent2)' }}>{label} </span>
                <span style={{ fontSize: 10, color: 'var(--muted)' }}>{desc}</span>
              </div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center', marginTop: 6 }}>
          <button className="btn btn-primary" style={{ fontSize: 18, padding: '10px 28px' }} onClick={completeTutorial}>
            BUILD MY SQUAD →
          </button>
        </div>
      </div>
    </div>
  )

  return null
}