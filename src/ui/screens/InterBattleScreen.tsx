import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import { pickCampBuffs } from '@data/campaign'
import type { CampBuff, Unit } from '@data/types'

export default function InterBattleScreen(): React.ReactElement {
  const {
    setScreen,
    campWave, campUnits, setCampUnits, setCampBuff,
    coins, diamonds,
  } = useStore()

  const [buffs]       = useState<CampBuff[]>(() => pickCampBuffs(3))
  const [chosen, setChosen]   = useState<CampBuff | null>(null)
  const [healAmounts] = useState<number[]>(() =>
    (campUnits ?? []).map(u => u ? Math.min(30, (u as Unit).maxHp - (u as Unit).hp) : 0)
  )
  const [revealed, setRevealed] = useState(false)

  useEffect(() => {
    // Apply healing to campUnits on mount
    if (campUnits) {
      const healed = campUnits.map(u => {
        if (!u) return u
        const unit = { ...(u as Unit) }
        unit.hp = Math.min(unit.maxHp, unit.hp + 30)
        return unit
      })
      setCampUnits(healed as Unit[])
    }
    const t = setTimeout(() => setRevealed(true), 100)
    return () => clearTimeout(t)
  }, [])

  function handleContinue() {
    if (!chosen) return

    // Apply buff to campUnits
    if (campUnits) {
      const units = campUnits.map(u => ({ ...(u as Unit) })) as Unit[]
      chosen.apply(units)
      setCampUnits(units)
    }

    setCampBuff(chosen.id)
    setScreen('battle')
  }

  const waveLabel = `WAVE ${campWave} OF 3 CLEARED`
  const nextWave  = `ENTERING WAVE ${campWave + 1}`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: 20, padding: 30,
      background: 'var(--bg)', pointerEvents: 'all',
      overflowY: 'auto',
      opacity: revealed ? 1 : 0,
      transition: 'opacity 0.35s ease',
    }}>

      {/* ── HEADER ── */}
      <div style={{ textAlign: 'center' }}>
        <h2 style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 38, color: 'var(--accent3)',
          filter: 'drop-shadow(0 0 16px rgba(60,255,180,0.4))',
        }}>
          BATTLE COMPLETE
        </h2>
        <p style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.15em', marginTop: 4 }}>
          {waveLabel}
        </p>
        <p style={{ fontSize: 11, color: 'var(--accent2)', letterSpacing: '0.12em', marginTop: 3,
          fontFamily: "'Bebas Neue', sans-serif",
        }}>
          {nextWave}
        </p>
      </div>

      {/* ── HEALING SECTION ── */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 600 }}>
        <div style={{
          fontSize: 10, color: 'var(--accent3)', letterSpacing: '0.15em', marginBottom: 10,
        }}>
          SQUAD HEALED (+30 HP EACH)
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          {(campUnits ?? []).map((u, i) => {
            if (!u) return null
            const unit     = u as Unit
            const healAmt  = healAmounts[i] ?? 0
            return (
              <div key={i} style={{
                background: 'var(--panel)',
                border: '2px solid var(--accent3)',
                padding: '9px 13px', textAlign: 'center', minWidth: 88,
              }}>
                <div style={{ fontSize: 20 }}>{unit.icon}</div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 12, color: 'var(--text)', marginTop: 3,
                }}>
                  {unit.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--accent3)', marginTop: 2 }}>
                  +{healAmt} → {unit.hp}/{unit.maxHp}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── BUFF CHOICE ── */}
      <div style={{ textAlign: 'center', width: '100%', maxWidth: 680 }}>
        <div style={{
          fontSize: 10, color: 'var(--accent2)', letterSpacing: '0.15em', marginBottom: 10,
        }}>
          CHOOSE A BONUS FOR THE NEXT BATTLE
        </div>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 12,
        }}>
          {buffs.map(buff => {
            const isChosen = chosen?.id === buff.id
            return (
              <div
                key={buff.id}
                onClick={() => setChosen(buff)}
                style={{
                  background: isChosen ? 'rgba(60,255,180,0.06)' : 'var(--panel)',
                  border: `2px solid ${isChosen ? 'var(--accent3)' : 'var(--border)'}`,
                  padding: 14, cursor: 'pointer',
                  transition: 'all 0.14s', textAlign: 'center',
                  boxShadow: isChosen ? '0 0 12px rgba(60,255,180,0.15)' : 'none',
                }}
              >
                <div style={{ fontSize: 26 }}>{buff.icon}</div>
                <div style={{
                  fontFamily: "'Bebas Neue', sans-serif",
                  fontSize: 17, color: 'var(--accent2)', marginTop: 6,
                }}>
                  {buff.name}
                </div>
                <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>
                  {buff.desc}
                </div>
                {isChosen && (
                  <div style={{
                    fontSize: 8, color: 'var(--accent3)',
                    marginTop: 6, letterSpacing: '0.1em',
                  }}>
                    ✓ SELECTED
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── NEXT BATTLE BUTTON ── */}
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexDirection: 'column' }}>
        <button
          className="btn btn-primary"
          disabled={!chosen}
          onClick={handleContinue}
          style={{ fontSize: 20, padding: '10px 32px' }}
        >
          ▶ NEXT BATTLE
        </button>
        {!chosen && (
          <span style={{ fontSize: 9, color: 'var(--muted)' }}>
            Select a bonus above first
          </span>
        )}
      </div>

      {/* ── WAVE PREVIEW ── */}
      <div style={{
        background: 'rgba(255,60,60,0.04)',
        border: '1px solid rgba(255,60,60,0.2)',
        borderLeft: '3px solid var(--accent)',
        padding: '8px 14px', maxWidth: 480, width: '100%',
        fontSize: 9, color: 'var(--muted)', lineHeight: 1.7,
      }}>
        <span style={{ color: 'var(--accent)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 12 }}>
          ⚠ WAVE {campWave + 1} WARNING:{' '}
        </span>
        {campWave + 1 === 2 && 'Enemies are stronger. +15 HP and smarter ability combos.'}
        {campWave + 1 === 3 && 'ELITE SQUAD. +30 HP, +10 bonus damage, hardened AI. This is the final battle.'}
      </div>

    </div>
  )
}