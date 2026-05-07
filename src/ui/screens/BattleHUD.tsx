import React, { useEffect, useRef } from 'react'
import Phaser from 'phaser'
import { useStore } from '@store'
import { isEnemyVisible } from '@systems/VisibilityEngine'
import {
  initBattle, selectUnit, doUndoMove,
  confirmAbility, cancelAbility, endPlayerTurn,
} from '@ui/battle/BattleController'
import BattleScene from '@ui/battle/BattleScene'
import { getDiffConfig } from '@data/difficulty'
import type { Unit, PreviewState } from '@data/types'

const CELL  = 42
const GSIZE = 15

// ── Status badges ────────────────────────────────────────────
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
  return <>
    {STS_DEFS.filter(([k]) => (unit.statuses as any)[k]).map(([k, label, cls]) => {
      const v   = (unit.statuses as any)[k]
      const dur = v && typeof v.dur === 'number' && v.dur < 99 ? ` ${v.dur}` : ''
      return <span key={k} className={`sb ${cls}`}>{label}{dur}</span>
    })}
  </>
}

// ── Unit panel card ──────────────────────────────────────────
function UnitCard({
  unit, isSelected, isEnemy, showHP,
  moved, acted, onClick,
}: {
  unit: Unit; isSelected: boolean; isEnemy: boolean
  showHP: boolean; moved?: boolean; acted?: boolean
  onClick?: () => void
}) {
  const hpPct    = Math.max(0, (unit.hp / unit.maxHp) * 100)
  const barClass = hpPct > 60 ? '' : hpPct > 30 ? 'mid' : 'low'
  const dead     = unit.hp <= 0
  const isInvis  = !!(unit.statuses.invisible as any)?.dur

  return (
    <div
      className={`ucard${dead ? ' dead' : ''}${isSelected ? ' active-t' : ''}${isInvis ? ' invis-c' : ''}`}
      style={{ cursor: !isEnemy && !dead ? 'pointer' : 'default' }}
      onClick={onClick}
    >
      <div className="uc-name" style={{ color: isEnemy ? 'var(--accent)' : 'var(--blue)' }}>
        {unit.icon} {unit.name}
        {isEnemy && (
          <span className={`pb pb-${unit.personality === 'aggressive' ? 'agg' : unit.personality === 'defensive' ? 'def' : 'trk'}`}>
            {unit.personality === 'aggressive' ? 'AGG' : unit.personality === 'defensive' ? 'DEF' : 'TRK'}
          </span>
        )}
        {!showHP && isEnemy && <span style={{ color: 'var(--muted)', fontSize: 6, marginLeft: 3 }}>[FOG]</span>}
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

      {/* Action budget indicators for player units */}
      {!isEnemy && !dead && (
        <div style={{ display: 'flex', gap: 3, marginTop: 3 }}>
          <div style={{
            fontSize: 7, padding: '1px 4px',
            border: `1px solid ${moved ? 'var(--muted)' : 'var(--blue)'}`,
            color: moved ? 'var(--muted)' : 'var(--blue)',
            opacity: moved ? 0.4 : 1,
          }}>
            {moved ? '✓MOV' : 'MOV'}
          </div>
          <div style={{
            fontSize: 7, padding: '1px 4px',
            border: `1px solid ${acted ? 'var(--muted)' : 'var(--accent2)'}`,
            color: acted ? 'var(--muted)' : 'var(--accent2)',
            opacity: acted ? 0.4 : 1,
          }}>
            {acted ? '✓ACT' : 'ACT'}
          </div>
        </div>
      )}
    </div>
  )
}

// ── Preview damage calc ──────────────────────────────────────
function calcPreviewDmg(preview: PreviewState): number | null {
  if (!preview.power.damage) return null
  const u   = preview.unit
  const emp = u.statuses.empowered ? 1.5 : 1
  const wk  = u.statuses.weakened  ? 0.6 : 1
  const amb = (preview.power.isAmbush && u.statuses.invisible) ? ((preview.power._ambushBonus ?? 0.5) + 1) : 1
  const brs = u.downside.id === 'berserker' ? 1.75 : 1
  let dmg   = Math.round(preview.power.damage * emp * wk * amb * brs)
  const t   = preview.targets[0]
  if (t) {
    if (t.statuses.marked)              dmg = Math.floor(dmg * 1.5)
    if (t.downside.id === 'glass_body') dmg = Math.floor(dmg * 1.5)
    if (t.statuses.shielded)            dmg = Math.floor(dmg * 0.5)
  }
  return dmg
}

// ── MAIN HUD ─────────────────────────────────────────────────
export default function BattleHUD(): React.ReactElement {
  const phaserRef = useRef<HTMLDivElement>(null)
  const gameRef   = useRef<Phaser.Game | null>(null)
  const logRef    = useRef<HTMLDivElement>(null)

  const {
    setScreen, units, round,
    battlePhase, selectedUnitId, unitActs,
    phase, setPhase, preview,
    visibleCells, fogReveal,
    mode, campWave, difficulty,
    coins, diamonds,
  } = useStore()

  const log = (useStore.getState() as any).log ?? []

  // Mount Phaser once
  useEffect(() => {
    if (!phaserRef.current || gameRef.current) return
    const W = GSIZE * CELL, H = GSIZE * CELL
    const game = new Phaser.Game({
      type:   Phaser.AUTO,
      width:  W, height: H,
      parent: phaserRef.current,
      backgroundColor: '#07070d',
      scene:  [BattleScene],
      scale:  { mode: Phaser.Scale.NONE, autoCenter: Phaser.Scale.NO_CENTER, width: W, height: H },
      input:  { mouse: { preventDefaultWheel: false }, touch: { capture: false } },
      render: { antialias: false, pixelArt: true },
    })
    gameRef.current = game
    game.events.once('ready', () => initBattle())
    return () => { game.destroy(true); gameRef.current = null }
  }, [])

  // Auto-scroll log
  useEffect(() => {
    if (logRef.current) logRef.current.scrollTop = logRef.current.scrollHeight
  }, [log.length])

  const playerUnits  = units.filter(u => u.team === 'player')
  const enemyUnits   = units.filter(u => u.team === 'enemy')
  const selectedUnit = units.find(u => u.id === selectedUnitId)
  const isPlayerPhase = battlePhase === 'player'
  const isEnemyPhase  = battlePhase === 'enemy'

  const dc = getDiffConfig(difficulty)

  // Count how many player units still have actions remaining
  const unitsWithActions = playerUnits.filter(u => {
    if (u.hp <= 0) return false
    const acts = unitActs[u.id]
    return acts && (!acts.moved || !acts.acted)
  }).length

  const selectedActs = selectedUnit ? (unitActs[selectedUnit.id] ?? { moved: false, acted: false }) : null

  function getPhaseLabel(): string {
    if (isEnemyPhase) return 'ENEMY PHASE — AI THINKING...'
    if (!isPlayerPhase) return 'PREPARING...'
    if (!selectedUnit) return 'SELECT A UNIT TO ACT'
    if (phase === 'move')    return `${selectedUnit.icon} ${selectedUnit.name} — CLICK BLUE TILE TO MOVE`
    if (phase === 'punch')   return `${selectedUnit.icon} ${selectedUnit.name} — CLICK ENEMY TO PUNCH (12 DMG)`
    if (phase === 'ability') return `${selectedUnit.icon} ${selectedUnit.name} — CLICK TARGET TO PREVIEW`
    if (phase === 'preview') return `${selectedUnit.icon} ${selectedUnit.name} — CONFIRM OR CANCEL`
    return `${selectedUnit.icon} ${selectedUnit.name} — CHOOSE AN ACTION`
  }

  const previewDmg = preview ? calcPreviewDmg(preview) : null

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', width: '100vw',
      background: 'var(--bg)', pointerEvents: 'all',
      overflow: 'hidden',
    }}>

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', padding: '5px 10px',
        flexWrap: 'wrap', gap: 4, background: 'var(--panel)', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: 'var(--accent)' }}>⚔ BATTLE</span>
          <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 10, letterSpacing: '0.1em', padding: '2px 6px', border: '1px solid var(--purple)', color: 'var(--purple)' }}>
            {mode === 'campaign' ? `WAVE ${campWave + 1}/3` : 'QUICK'}
          </span>
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 10, letterSpacing: '0.1em',
            padding: '2px 7px', border: `1px solid ${dc.label === 'HARD' ? 'var(--accent)' : dc.label === 'EASY' ? 'var(--accent3)' : 'var(--accent2)'}`,
            color: dc.label === 'HARD' ? 'var(--accent)' : dc.label === 'EASY' ? 'var(--accent3)' : 'var(--accent2)',
          }}>
            {dc.label}
          </span>
          {/* Phase indicator */}
          <span style={{
            fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: '0.1em',
            color: isPlayerPhase ? 'var(--blue)' : isEnemyPhase ? 'var(--accent)' : 'var(--muted)',
          }}>
            {isPlayerPhase ? '● YOUR TURN' : isEnemyPhase ? '● ENEMY TURN' : ''}
          </span>
        </div>

        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 15, color: 'var(--accent2)', letterSpacing: '0.07em' }}>
          ROUND {round}
        </div>
      </div>

      {/* ── MAIN AREA ── */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>

        {/* ── LEFT: Player units ── */}
        <div style={{
          width: 158, minWidth: 158, padding: '6px 5px',
          overflowY: 'auto', borderRight: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 4 }}>── YOUR SQUAD ──</div>
          {playerUnits.map(u => {
            const acts    = unitActs[u.id] ?? { moved: false, acted: false }
            const isSel   = u.id === selectedUnitId
            return (
              <UnitCard
                key={u.id}
                unit={u}
                isSelected={isSel}
                isEnemy={false}
                showHP={true}
                moved={acts.moved}
                acted={acts.acted}
                onClick={() => { if (isPlayerPhase && !u.hp) return; selectUnit(u.id) }}
              />
            )
          })}

          {/* Actions remaining indicator */}
          {isPlayerPhase && (
            <div style={{
              marginTop: 6, padding: '4px 6px', fontSize: 8,
              border: '1px solid var(--border)', color: unitsWithActions > 0 ? 'var(--accent3)' : 'var(--muted)',
              textAlign: 'center',
            }}>
              {unitsWithActions > 0 ? `${unitsWithActions} unit${unitsWithActions > 1 ? 's' : ''} can still act` : 'All units done'}
            </div>
          )}
        </div>

        {/* ── CENTER: Phaser + controls ── */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', overflow: 'auto', background: 'var(--bg)', padding: '4px 0' }}>

          {/* Fog legend */}
          <div style={{ display: 'flex', gap: 8, fontSize: 7, color: 'var(--muted)', alignItems: 'center', marginBottom: 3, flexWrap: 'wrap', justifyContent: 'center' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(60,143,255,0.22)', border: '1px solid var(--blue)', marginRight: 2 }} />VIS</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--fog)', border: '1px solid #191927', marginRight: 2 }} />FOG</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'rgba(192,60,255,0.18)', border: '1px solid var(--purple)', marginRight: 2 }} />INVIS</span>
          </div>

          {/* Phaser canvas */}
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
                <div style={{ display: 'flex', gap: 9, marginTop: 2, flexWrap: 'wrap' }}>
                  {previewDmg !== null && (
                    <span style={{ color: 'var(--muted)' }}>DMG: <span style={{ color: previewDmg >= 50 ? '#f33' : previewDmg >= 30 ? '#fb0' : 'var(--text)' }}>{previewDmg}</span></span>
                  )}
                  {preview.power.heal && <span style={{ color: 'var(--muted)' }}>HEAL: <span style={{ color: 'var(--accent3)' }}>{preview.power.heal}</span></span>}
                  {preview.targets.length > 1 && <span style={{ color: 'var(--muted)' }}>× <span style={{ color: 'var(--text)' }}>{preview.targets.length}</span></span>}
                  {selectedUnit?.downside.id === 'unstable_aim'    && <span style={{ color: 'var(--accent)' }}>25% MISS</span>}
                  {selectedUnit?.downside.id === 'delayed_action'  && !selectedUnit?.statuses.stabilized && <span style={{ color: '#a0f' }}>NEXT ROUND</span>}
                  {selectedUnit?.downside.id === 'stunned_after'   && !selectedUnit?.statuses.stabilized && !preview.power._noStunAfter && <span style={{ color: '#aaa' }}>SELF-STUN</span>}
                  {selectedUnit?.downside.id === 'backfire'        && <span style={{ color: 'var(--accent)' }}>-10 SELF</span>}
                </div>
              </div>
              <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: '0.06em', padding: '5px 13px', border: '2px solid var(--accent3)', color: 'var(--accent3)', background: 'transparent', cursor: 'pointer' }} onClick={confirmAbility}>
                ✓ CONFIRM
              </button>
              <button style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, padding: '5px 10px', border: '1px solid var(--muted)', color: 'var(--muted)', background: 'transparent', cursor: 'pointer' }} onClick={cancelAbility}>
                ✕
              </button>
            </div>
          )}

          {/* ── ACTION BAR ── */}
          <div style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            padding: '8px 12px', display: 'flex', gap: 6,
            alignItems: 'center', width: '100%', maxWidth: GSIZE * CELL,
            flexWrap: 'wrap', flexShrink: 0,
          }}>
            {/* Status text */}
            <div style={{ flex: 1, minWidth: 140 }}>
              <div style={{ fontSize: 7, letterSpacing: '0.18em', color: isPlayerPhase ? 'var(--blue)' : 'var(--accent)', textTransform: 'uppercase', marginBottom: 1 }}>
                {isPlayerPhase ? 'YOUR PHASE' : isEnemyPhase ? 'ENEMY PHASE' : 'WAITING'}
              </div>
              <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.4 }}>
                {getPhaseLabel()}
              </div>
            </div>

            {/* MOVE button */}
            <button
              className={`btn-act ba-move${phase === 'move' ? ' act' : ''}`}
              disabled={!isPlayerPhase || !selectedUnit || selectedUnit.hp <= 0 || selectedActs?.moved || selectedUnit.downside.id === 'locked_pos'}
              onClick={() => setPhase(phase === 'move' ? 'idle' : 'move')}
            >MOVE</button>

            {/* PUNCH button */}
            <button
              className={`btn-act ba-punch${phase === 'punch' ? ' act' : ''}`}
              disabled={!isPlayerPhase || !selectedUnit || selectedUnit.hp <= 0 || selectedActs?.acted}
              onClick={() => setPhase(phase === 'punch' ? 'idle' : 'punch')}
            >PUNCH</button>

            {/* ABILITY button — shows power name */}
            <button
              className={`btn-act ba-abil${(phase === 'ability' || phase === 'preview') ? ' act' : ''}`}
              disabled={!isPlayerPhase || !selectedUnit || selectedUnit.hp <= 0 || selectedActs?.acted || selectedUnit.downside.id === 'ghost_body' || phase === 'preview'}
              onClick={() => setPhase((phase === 'ability') ? 'idle' : 'ability')}
            >
              {selectedUnit?.power?.name?.toUpperCase() ?? 'ABILITY'}
            </button>

            {/* UNDO */}
            <button
              className="btn-act ba-undo"
              disabled={!isPlayerPhase || !selectedUnit || !useStore.getState().undoPos || selectedActs?.acted}
              onClick={doUndoMove}
              title="Undo Move"
            >↩</button>

            {/* END TURN — always visible, ends entire player phase */}
            <button
              className="btn-act ba-end"
              disabled={!isPlayerPhase || phase === 'preview'}
              onClick={endPlayerTurn}
              style={{ minWidth: 80 }}
            >
              END TURN
            </button>
          </div>
        </div>

        {/* ── RIGHT: Enemy units ── */}
        <div style={{
          width: 158, minWidth: 158, padding: '6px 5px',
          overflowY: 'auto', borderLeft: '1px solid var(--border)',
          background: 'var(--bg)',
        }}>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 4 }}>── ENEMY SQUAD ──</div>
          {enemyUnits.map(u => {
            const vis = u.hp <= 0 || isEnemyVisible(u, visibleCells, fogReveal)
            return (
              <UnitCard key={u.id} unit={u} isSelected={false} isEnemy={true} showHP={vis} />
            )
          })}
        </div>
      </div>

      {/* ── BATTLE LOG ── */}
      <div ref={logRef} className="battle-log" style={{ maxHeight: 80, overflowY: 'auto', flexShrink: 0 }}>
        {log.slice(-60).map((entry: any, i: number) => (
          <div key={entry.id ?? i} className={`le ${entry.type}`}>› {entry.msg}</div>
        ))}
      </div>

    </div>
  )
}