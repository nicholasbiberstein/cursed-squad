import React, { useEffect, useRef, useState } from 'react'
import Phaser from 'phaser'
import { useStore } from '@store'
import { isEnemyVisible } from '@systems/VisibilityEngine'
import {
  initBattle, doMove, doPunch, doUndoMove,
  confirmAbility, cancelAbility, endPlayerTurn,
} from '@ui/battle/BattleController'
import BattleScene from '@ui/battle/BattleScene'
import { getDiffConfig } from '@data/difficulty'
import type { Unit } from '@data/types'

// ============================================================
// BATTLE HUD — React overlay on top of Phaser canvas
// ============================================================

const CELL = 42
const GSIZE = 15

// Status badge config
const STS_DEFS = [
  ['stunned',   '😵STUN',  'sb-stun'],
  ['shielded',  '🛡SHLD',  'sb-shield'],
  ['marked',    '🎯MRK',   'sb-mark'],
  ['poison',    '🧪PSN',   'sb-poison'],
  ['burn',      '🔥BURN',  'sb-burn'],
  ['regen',     '💚REG',   'sb-regen'],
  ['hasted',    '💨HST',   'sb-haste'],
  ['slowed',    '🐢SLW',   'sb-slow'],
  ['weakened',  '⬇WEAK',   'sb-weak'],
  ['empowered', '⚡PWR',   'sb-emp'],
  ['confused',  '🌀CNF',   'sb-conf'],
  ['invisible', '👻INV',   'sb-invis'],
] as const

function StatusBadges({ unit }: { unit: Unit }) {
  if (unit.pendingAbility) return <span className="sb sb-chrg">⏳CHRG</span>
  return (
    <>
      {STS_DEFS.filter(([k]) => (unit.statuses as any)[k]).map(([k, label, cls]) => {
        const v = (unit.statuses as any)[k]
        const dur = v && typeof v.dur === 'number' && v.dur < 99 ? ` ${v.dur}` : ''
        return <span key={k} className={`sb ${cls}`}>{label}{dur}</span>
      })}
    </>
  )
}

function UnitCard({ unit, isActive, showHP }: { unit: Unit; isActive: boolean; showHP: boolean }) {
  const hpPct    = Math.max(0, (unit.hp / unit.maxHp) * 100)
  const barClass = hpPct > 60 ? '' : hpPct > 30 ? 'mid' : 'low'
  const isInvis  = !!(unit.statuses.invisible as any)?.dur || unit.statuses.invisible === true
  const isBuffed = !!(unit.statuses.empowered || unit.statuses.regen)
  const dead     = unit.hp <= 0

  return (
    <div className={`ucard${dead ? ' dead' : ''}${isActive ? ' active-t' : ''}${isInvis ? ' invis-c' : ''}${isBuffed && !dead ? ' buffed-c' : ''}`}>
      <div className="uc-name">
        {unit.icon} {unit.name}
        {unit.team === 'enemy' && (
          <span className={`pb pb-${unit.personality === 'aggressive' ? 'agg' : unit.personality === 'defensive' ? 'def' : 'trk'}`}>
            {unit.personality === 'aggressive' ? 'AGG' : unit.personality === 'defensive' ? 'DEF' : 'TRK'}
          </span>
        )}
        {!showHP && unit.team === 'enemy' && (
          <span style={{ color: 'var(--muted)', fontSize: 6, marginLeft: 3 }}>[FOG]</span>
        )}
      </div>
      {showHP ? (
        <>
          <div className="hp-wrap"><div className={`hp-fill ${barClass}`} style={{ width: `${hpPct}%` }} /></div>
          <div className="uc-hp">{unit.hp}/{unit.maxHp}</div>
        </>
      ) : (
        <div className="uc-hp" style={{ color: 'var(--muted)' }}>??? HP</div>
      )}
      <div className="uc-tags">
        <span className="utag utag-p" style={{ fontSize: 6 }}>{unit.power?.icon} {unit.power?.name}</span>
        <span className="utag utag-d" style={{ fontSize: 6 }}>{unit.downside?.icon} {unit.downside?.name}</span>
      </div>
      <div className="uc-sbadges"><StatusBadges unit={unit} /></div>
    </div>
  )
}

// ── LOG ENTRY ────────────────────────────────────────────────
interface LogEntry { msg: string; type: string; id: number }

export default function BattleHUD(): React.ReactElement {
  const phaserRef = useRef<HTMLDivElement>(null)
  const gameRef   = useRef<Phaser.Game | null>(null)
  const logRef    = useRef<HTMLDivElement>(null)

  const {
    setScreen, units, turnOrder, turnIdx, round,
    phase, setPhase, act, preview, undoPos,
    visibleCells, fogReveal, mode, campWave, difficulty,
    coins, diamonds,
  } = useStore()

  const log: LogEntry[] = (useStore.getState() as any).log ?? []

  // ── Mount Phaser ──────────────────────────────────────────
  useEffect(() => {
    if (!phaserRef.current || gameRef.current) return

    const W = GSIZE * CELL
    const H = GSIZE * CELL

    const game = new Phaser.Game({
      type:   Phaser.AUTO,
      width:  W,
      height: H,
      parent: phaserRef.current,
      backgroundColor: '#07070d',
      scene:  [BattleScene],
      scale: {
        mode:       Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.NO_CENTER,
        width:      W,
        height:     H,
      },
      input: {
        mouse: { preventDefaultWheel: false },
        touch: { capture: false },
      },
      render: { antialias: false, pixelArt: true },
    })

    gameRef.current = game

    // Init battle after Phaser is ready
    game.events.once('ready', () => initBattle())

    return () => {
      game.destroy(true)
      gameRef.current = null
    }
  }, [])

  // ── Auto-scroll log ───────────────────────────────────────
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log.length])

  const curUnit = units.find(u => u.id === turnOrder[turnIdx])
  const isMyTurn = curUnit?.team === 'player' && curUnit.hp > 0

  const playerUnits = units.filter(u => u.team === 'player')
  const enemyUnits  = units.filter(u => u.team === 'enemy')

  const dc = getDiffConfig(difficulty)

  // Preview damage calculation
  function calcPreviewDmg(): number | null {
    if (!preview?.power.damage) return null
    const u   = preview.unit
    const emp = u.statuses.empowered ? 1.5 : 1
    const wk  = u.statuses.weakened  ? 0.6 : 1
    const amb = (preview.power.isAmbush && u.statuses.invisible) ? ((preview.power._ambushBonus ?? 0.5) + 1) : 1
    const brs = u.downside.id === 'berserker' ? 1.75 : 1
    let dmg   = Math.round((preview.power.damage) * emp * wk * amb * brs)
    const t   = preview.targets[0]
    if (t) {
      if (t.statuses.marked)              dmg = Math.floor(dmg * 1.5)
      if (t.downside.id === 'glass_body') dmg = Math.floor(dmg * 1.5)
      if (t.statuses.shielded)            dmg = Math.floor(dmg * 0.5)
    }
    return dmg
  }

  function getStatusLabel(): string {
    if (!isMyTurn) return curUnit ? `${curUnit.icon} ${curUnit.name} — AI thinking...` : 'Waiting...'
    if (phase === 'move')    return '🔵 Click a blue tile to move'
    if (phase === 'punch')   return '👊 Click an orange tile to punch (12 dmg)'
    if (phase === 'ability') return '🔴 Click a target to preview the action'
    if (phase === 'preview') return '✓ Confirm or ✕ cancel the action'
    return `${curUnit?.icon} ${curUnit?.name} — choose an action`
  }

  const previewDmg = calcPreviewDmg()

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      background: 'var(--bg)', pointerEvents: 'all',
      overflow: 'hidden', position: 'relative',
    }}>

      {/* ── TOP BAR ── */}
      <div className="battle-top" style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', padding: '5px 10px',
        flexWrap: 'wrap', gap: 4, background: 'var(--panel)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: 'var(--accent)' }}>⚔ BATTLE</span>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 10, letterSpacing: '0.1em',
            padding: '2px 6px', border: '1px solid var(--purple)', color: 'var(--purple)',
          }}>
            {mode === 'campaign' ? `WAVE ${campWave + 1}/3` : 'QUICK'}
          </span>
          <span style={{ fontSize: 9, color: dc.label === 'HARD' ? 'var(--accent)' : dc.label === 'EASY' ? 'var(--accent3)' : 'var(--accent2)', letterSpacing: '0.1em' }}>
            {dc.label}
          </span>
        </div>

        {/* Turn order pips */}
        <div style={{ display: 'flex', gap: 3, alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 6, color: 'var(--muted)', letterSpacing: '0.1em' }}>ORDER:</span>
          {turnOrder.map((uid, i) => {
            const u = units.find(x => x.id === uid); if (!u) return null
            return (
              <div key={uid} className={`tpip ${u.team === 'player' ? 'pp' : 'ep'}${u.hp <= 0 ? ' dp' : ''}${i === turnIdx ? ' cur' : ''}`}>
                {u.name.replace('UNIT ', 'U').replace('FOE ', 'F')}
              </div>
            )
          })}
        </div>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--accent2)', letterSpacing: '0.07em' }}>
          ROUND {round}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ display: 'flex', flex: 1, gap: 0, overflow: 'hidden' }}>

        {/* ── LEFT: Player units ── */}
        <div style={{
          width: 150, minWidth: 150, padding: '6px 5px', overflowY: 'auto',
          borderRight: '1px solid var(--border)', background: 'var(--bg)',
        }}>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 4 }}>── YOUR SQUAD ──</div>
          {playerUnits.map(u => (
            <UnitCard key={u.id} unit={u} isActive={curUnit?.id === u.id} showHP={true} />
          ))}
        </div>

        {/* ── CENTER: Phaser canvas ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', background: 'var(--bg)', padding: '4px 0' }}>

          {/* Fog legend */}
          <div style={{ display: 'flex', gap: 8, fontSize: 7, color: 'var(--muted)', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(60,143,255,0.22)', border: '1px solid var(--blue)', marginRight: 2 }} />VIS</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--fog)', border: '1px solid #191927', marginRight: 2 }} />FOG</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(192,60,255,0.18)', border: '1px solid var(--purple)', marginRight: 2 }} />INVIS</span>
          </div>

          {/* Phaser canvas mount point */}
          <div
            ref={phaserRef}
            style={{ cursor: 'crosshair' }}
            onWheel={e => e.currentTarget.parentElement?.scrollBy({ top: e.deltaY, behavior: 'auto' })}
          />

          {/* Preview bar */}
          {preview && (
            <div style={{
              background: 'rgba(10,10,20,0.96)', border: '1px solid var(--accent2)',
              padding: '6px 12px', display: 'flex', gap: 10, alignItems: 'center',
              flexWrap: 'wrap', fontSize: 9, width: '100%', maxWidth: GSIZE * CELL,
            }}>
              <div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--accent2)' }}>
                  {preview.power.icon} {preview.power.name.toUpperCase()}
                </div>
                <div style={{ display: 'flex', gap: 9, marginTop: 2 }}>
                  {previewDmg !== null && (
                    <span style={{ color: 'var(--muted)' }}>DMG: <span style={{ color: previewDmg >= 50 ? '#f33' : previewDmg >= 30 ? '#fb0' : 'var(--text)' }}>{previewDmg}</span></span>
                  )}
                  {preview.power.heal && (
                    <span style={{ color: 'var(--muted)' }}>HEAL: <span style={{ color: 'var(--accent3)' }}>{preview.power.heal}</span></span>
                  )}
                  {preview.targets.length > 1 && (
                    <span style={{ color: 'var(--muted)' }}>×<span style={{ color: 'var(--text)' }}>{preview.targets.length}</span></span>
                  )}
                  {curUnit?.downside.id === 'unstable_aim' && (
                    <span style={{ color: 'var(--accent)' }}>25% MISS</span>
                  )}
                  {curUnit?.downside.id === 'delayed_action' && !curUnit?.statuses.stabilized && (
                    <span style={{ color: '#a0f' }}>NEXT TURN</span>
                  )}
                  {curUnit?.downside.id === 'stunned_after' && !curUnit?.statuses.stabilized && !preview.power._noStunAfter && (
                    <span style={{ color: '#aaa' }}>SELF-STUN</span>
                  )}
                  {curUnit?.downside.id === 'backfire' && (
                    <span style={{ color: 'var(--accent)' }}>-10 SELF</span>
                  )}
                </div>
              </div>
              <button
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: '0.06em', padding: '5px 13px', border: '2px solid var(--accent3)', color: 'var(--accent3)', background: 'transparent', cursor: 'pointer' }}
                onClick={confirmAbility}
              >
                ✓ CONFIRM
              </button>
              <button
                style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, padding: '5px 10px', border: '1px solid var(--muted)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer' }}
                onClick={cancelAbility}
              >
                ✕
              </button>
            </div>
          )}

          {/* Action bar */}
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            padding: '7px 11px', display: 'flex', gap: 5,
            alignItems: 'center', width: '100%', maxWidth: GSIZE * CELL,
            flexWrap: 'wrap',
          }}>
            <div style={{ flex: 1, minWidth: 120 }}>
              <div style={{ fontSize: 7, letterSpacing: '0.2em', color: 'var(--accent3)', textTransform: 'uppercase', marginBottom: 1 }}>
                {act.doubleUsed ? 'YOUR TURN (BONUS)' : isMyTurn ? 'YOUR TURN' : 'ENEMY TURN'}
              </div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: 'var(--accent2)' }}>
                {curUnit ? `${curUnit.icon} ${curUnit.name}` : '—'}
              </div>
              <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 1, lineHeight: 1.3 }}>
                {getStatusLabel()}
              </div>
            </div>

            {/* MOVE */}
            <button
              className={`btn-act ba-move${phase === 'move' ? ' act' : ''}`}
              disabled={!isMyTurn || act.moved || (curUnit?.downside.id === 'locked_pos' && !curUnit?.statuses.stabilized)}
              onClick={() => useStore.setState({ phase: phase === 'move' ? 'idle' : 'move', preview: null })}
            >MOVE</button>

            {/* PUNCH */}
            <button
              className={`btn-act ba-punch${phase === 'punch' ? ' act' : ''}`}
              disabled={!isMyTurn || act.punched}
              onClick={() => useStore.setState({ phase: phase === 'punch' ? 'idle' : 'punch', preview: null })}
            >PUNCH</button>

            {/* ABILITY */}
            <button
              className={`btn-act ba-abil${phase === 'ability' || phase === 'preview' ? ' act' : ''}`}
              disabled={!isMyTurn || act.abilitied || (curUnit?.downside.id === 'ghost_body' && !curUnit?.statuses.stabilized) || phase === 'preview'}
              onClick={() => useStore.setState({ phase: phase === 'ability' ? 'idle' : 'ability', preview: null })}
            >
              {curUnit?.power?.name?.toUpperCase() ?? 'ABILITY'}
            </button>

            {/* UNDO */}
            <button
              className="btn-act ba-undo"
              disabled={!isMyTurn || !undoPos || act.abilitied || act.punched}
              onClick={doUndoMove}
              title="Undo Move"
            >↩</button>

            {/* END TURN */}
            <button
              className="btn-act ba-end"
              disabled={!isMyTurn || phase === 'preview'}
              onClick={endPlayerTurn}
            >END</button>
          </div>
        </div>

        {/* ── RIGHT: Enemy units ── */}
        <div style={{
          width: 150, minWidth: 150, padding: '6px 5px', overflowY: 'auto',
          borderLeft: '1px solid var(--border)', background: 'var(--bg)',
        }}>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 4 }}>── ENEMY SQUAD ──</div>
          {enemyUnits.map(u => {
            const vis = u.hp <= 0 || isEnemyVisible(u, visibleCells, fogReveal)
            return <UnitCard key={u.id} unit={u} isActive={curUnit?.id === u.id} showHP={vis} />
          })}
        </div>
      </div>

      {/* ── BATTLE LOG ── */}
      <div
        ref={logRef}
        className="battle-log"
        style={{ maxHeight: 80, overflowY: 'auto' }}
      >
        {log.slice(-60).map((entry, i) => (
          <div key={entry.id ?? i} className={`le ${entry.type} new`}>› {entry.msg}</div>
        ))}
      </div>

    </div>
  )
}