import React, { useEffect } from 'react'
import { useStore } from '@store'
import { WAVE_DEFS } from '@data/campaign'
import { rarColor, rarLabel } from '@data/rarity'
import type { Unit } from '@data/types'

export default function CampaignScreen(): React.ReactElement {
  const {
    setScreen, setMode,
    buildSlots, setBuildSlot,
    campWave, setCampWave, setCampUnits,
    campUnits,
    coins, diamonds,
  } = useStore()

  const squadSource = campUnits ?? buildSlots
  const filledSlots = squadSource.filter(Boolean)
  const canStart    = filledSlots.length === 5

  function handleStart() {
    if (!canStart) return
    setMode('campaign')
    setScreen('battle')
  }

  function handleChangeSquad() {
    setMode('campaign')
    setScreen('build')
  }

  function handleNewCampaign() {
    setCampWave(0)
    setCampUnits(null)
    Array(5).fill(null).forEach((_, i) => setBuildSlot(i, null))
    setMode('campaign')
    setScreen('build')
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: 20, padding: 28,
      background: 'var(--bg)', pointerEvents: 'all',
      overflowY: 'auto',
    }}>

      {/* ── HEADER ── */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 42, color: 'var(--accent2)',
          filter: 'drop-shadow(0 0 18px rgba(255,184,0,0.3))',
        }}>
          ⚔ CAMPAIGN
        </h2>
        <p style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em', marginTop: 4 }}>
          THREE BATTLES · ESCALATING ENEMIES · ONE SQUAD
        </p>
      </div>

      {/* ── WAVE TRACK ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
        {WAVE_DEFS.map((wave, i) => {
          const isDone    = i < campWave
          const isCurrent = i === campWave
          const isLocked  = i > campWave
          return (
            <React.Fragment key={i}>
              {i > 0 && (
                <div style={{
                  width: 28, height: 2,
                  background: isDone ? 'var(--accent3)' : 'var(--border)',
                  transition: 'background 0.3s',
                }} />
              )}
              <div style={{
                width: 82, height: 82,
                border: `2px solid ${isDone ? 'var(--accent3)' : isCurrent ? 'var(--accent2)' : 'var(--border)'}`,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center', gap: 3,
                fontSize: 9, color: isDone ? 'var(--accent3)' : isCurrent ? 'var(--accent2)' : 'var(--muted)',
                opacity: isLocked ? 0.3 : 1,
                boxShadow: isCurrent ? '0 0 14px rgba(255,184,0,0.2)' : 'none',
                transition: 'all 0.2s',
              }}>
                <div style={{ fontSize: 22 }}>{isDone ? '✓' : wave.icon}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, letterSpacing: '0.05em' }}>
                  {wave.label}
                </div>
                <div style={{ fontSize: 7, textAlign: 'center', lineHeight: 1.3 }}>
                  {wave.desc}
                </div>
              </div>
            </React.Fragment>
          )
        })}
      </div>

      {/* ── SQUAD SUMMARY ── */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--border)',
        padding: '14px 20px', maxWidth: 640, width: '100%',
      }}>
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 16, color: 'var(--accent2)', marginBottom: 10,
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        }}>
          <span>YOUR SQUAD</span>
          {campUnits && (
            <span style={{ fontSize: 9, color: 'var(--accent3)', letterSpacing: '0.1em' }}>
              ← PERSISTED FROM LAST BATTLE
            </span>
          )}
        </div>

        {filledSlots.length === 0 ? (
          <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: 12 }}>
            No squad built yet.{' '}
            <span
              style={{ color: 'var(--accent2)', cursor: 'pointer', textDecoration: 'underline' }}
              onClick={handleChangeSquad}
            >
              Build your squad →
            </span>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 7, flexWrap: 'wrap' }}>
            {squadSource.map((u, i) => {
              if (!u) return null
              const unit = u as Unit
              const rc   = rarColor(unit.power?.rarity ?? 'common')
              const alive = unit.hp > 0
              return (
                <div key={i} style={{
                  background: 'var(--panel2)',
                  border: `1px solid ${alive ? 'var(--border)' : 'rgba(255,60,60,0.3)'}`,
                  padding: '6px 10px', fontSize: 8, minWidth: 90,
                  opacity: alive ? 1 : 0.5,
                }}>
                  <div style={{ fontSize: 18, marginBottom: 2 }}>{unit.icon}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--text)' }}>
                    {unit.name}
                  </div>
                  <div style={{ color: rc, fontSize: 7, marginTop: 2 }}>
                    {unit.power?.icon} {unit.power?.name}
                  </div>
                  <div style={{ color: 'var(--accent)', fontSize: 7 }}>
                    {unit.downside?.icon} {unit.downside?.name}
                  </div>
                  {campUnits && (
                    <div style={{ color: alive ? 'var(--accent3)' : 'var(--accent)', fontSize: 7, marginTop: 2 }}>
                      {alive ? `${unit.hp}/${unit.maxHp} HP` : '✝ FALLEN'}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* ── INFO BOX ── */}
      <div style={{
        background: 'rgba(255,184,0,0.04)',
        border: '1px solid rgba(255,184,0,0.2)',
        borderLeft: '3px solid var(--accent2)',
        padding: '8px 14px', maxWidth: 500, width: '100%',
        fontSize: 9, color: 'var(--muted)', lineHeight: 1.7,
      }}>
        <span style={{ color: 'var(--accent2)' }}>How campaign works: </span>
        Fight 3 consecutive battles with the same squad. Between battles your
        units are <span style={{ color: 'var(--accent3)' }}>partially healed</span> and
        you choose a <span style={{ color: 'var(--accent2)' }}>tactical bonus</span>.
        Enemies get stronger each wave. Win all 3 for the <span style={{ color: 'var(--accent2)' }}>LEGEND reward</span>.
      </div>

      {/* ── BUTTONS ── */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button
          className="btn btn-primary"
          disabled={!canStart}
          onClick={handleStart}
          title={!canStart ? 'Build your squad first' : ''}
        >
          ▶ ENTER BATTLE {campWave > 0 ? `(WAVE ${campWave + 1})` : ''}
        </button>

        <button className="btn btn-secondary" onClick={handleChangeSquad}>
          {campUnits ? 'VIEW SQUAD' : 'BUILD SQUAD'}
        </button>

        {campWave > 0 && (
          <button className="btn btn-secondary" onClick={handleNewCampaign}>
            ↺ NEW CAMPAIGN
          </button>
        )}

        <button className="btn btn-secondary" onClick={() => setScreen('title')}>
          ← BACK
        </button>
      </div>

      {/* Currency */}
      <div className="cur-bar">
        <div className="cur-item">
          <span className="cur-icon">🪙</span>
          <span className="cur-val">{coins}</span>
          <span className="cur-label">COINS</span>
        </div>
        <div className="cur-item">
          <span className="cur-icon">💎</span>
          <span className="cur-val">{diamonds}</span>
          <span className="cur-label">DIAMONDS</span>
        </div>
      </div>

    </div>
  )
}