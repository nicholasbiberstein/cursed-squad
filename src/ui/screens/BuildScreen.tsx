import React, { useState } from 'react'
import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, rarLabel, SYN_TAGS, POWER_CATS } from '@data/rarity'
import { applyRefinements, getRefineOptions } from '@data/refinements'
import { save } from '@systems/SaveManager'
import { assignPersonality } from '@systems/UnitFactory'
import type { Unit, ForgedEntry } from '@data/types'

const VISION_DEFAULT = 5
const PLAYER_ICONS = ['🧍', '🧟', '🤖', '💂', '🧙']

function buildUnitFromEntry(entry: ForgedEntry, slotIndex: number): Unit | null {
  const basePower = ALL_POWERS.find(p => p.id === entry.powerId)
  const curse     = ALL_CURSES.find(c => c.id === entry.curseId)
  if (!basePower || !curse) return null
  const power = applyRefinements(entry.refinements ?? [], basePower)
  const spd   = (curse.id === 'slow_react' || curse.id === 'delayed_reflex') ? 1 : (10 + Math.floor(Math.random() * 6))
  const vision = curse.id === 'blind' ? 2 : VISION_DEFAULT
  return {
    id: `player_${slotIndex}`,
    name: `UNIT ${slotIndex + 1}`,
    icon: PLAYER_ICONS[slotIndex % PLAYER_ICONS.length],
    team: 'player',
    power,
    downside: curse,
    maxHp: 100, hp: 100,
    speed: spd, vision,
    personality: assignPersonality(power, curse),
    statuses: {}, turnCount: 0, pendingAbility: null,
    pos: { r: 0, c: 0 },
  }
}

export default function BuildScreen(): React.ReactElement {
  const {
    setScreen,
    buildSlots, setBuildSlot,
    activeSlot, setActiveSlot,
    selPowerId, setSelPowerId,
    powerFilter, setPowerFilter,
    forged, savedSquads,
    saveSquad, deleteSquad,
    dismissHints, hintsDismissed,
    coins, diamonds,
  } = useStore()

  const [squadName, setSquadName] = useState('')

  const filled    = buildSlots.filter(Boolean).length
  const canLaunch = filled === 5

  // Filtered forged list
  const visibleForged = powerFilter === 'all'
    ? forged
    : forged.filter(f => {
        const p = ALL_POWERS.find(x => x.id === f.powerId)
        return p?.cat === powerFilter
      })

  const selectedEntry = selPowerId ? forged.find(f => f.powerId === selPowerId) ?? null : null
  const selectedPower = selPowerId ? ALL_POWERS.find(p => p.id === selPowerId) ?? null : null
  const selectedCurse = selectedEntry ? ALL_CURSES.find(c => c.id === selectedEntry.curseId) ?? null : null
  const selectedRefs  = selectedPower ? getRefineOptions(selectedPower) : []

  function handleAssign() {
    if (activeSlot === null || !selPowerId || !selectedEntry) return
    const unit = buildUnitFromEntry(selectedEntry, activeSlot)
    if (!unit) return
    setBuildSlot(activeSlot, unit)
    setActiveSlot(null)
    setSelPowerId(null)
  }

  function handleLaunch() {
    if (!canLaunch) return
    useStore.getState().setSavedSquad(buildSlots as (Unit | null)[])
    setScreen('battle')
  }

  function handleSave() {
    const name = squadName.trim() || `Squad ${savedSquads.length + 1}`
    saveSquad(name)
    setSquadName('')
  }

  function handleLoad(idx: number) {
    const sq = save.squads[idx]
    if (!sq) return
    sq.slots.forEach((slot, i) => {
      if (!slot) { setBuildSlot(i, null); return }
      const s = slot as Unit
      const entry = forged.find(f => f.powerId === s.power?.id)
      if (entry) {
        const unit = buildUnitFromEntry(entry, i)
        setBuildSlot(i, unit)
      } else {
        setBuildSlot(i, null)
      }
    })
  }

  const statusLabel = (() => {
    if (activeSlot === null) return 'Select a slot to begin'
    if (!selPowerId) return `Slot ${activeSlot + 1} — pick a forged power`
    return '✓ Ready — click ASSIGN'
  })()

  return (
    <div className="screen" style={{
      flexDirection: 'column',
      padding: '14px 18px', gap: 12,
      maxWidth: 1200, margin: '0 auto', width: '100%',
      background: 'var(--bg)',
      overflowY: 'auto',
      height: '100vh',
    }}>

      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', paddingBottom: 10,
        flexWrap: 'wrap', gap: 7,
      }}>
        <h2 style={{ fontSize: 24, color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif" }}>
          SQUAD BUILDER <span style={{ fontSize: 12, color: 'var(--muted)' }}>(5 UNITS)</span>
        </h2>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
          <div className="cur-bar" style={{ padding: '4px 9px' }}>
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
          <span style={{ fontSize: 8, color: 'var(--accent2)', letterSpacing: '0.1em' }}>
            {activeSlot !== null ? `SLOT ${activeSlot + 1} ACTIVE` : 'SELECT A SLOT'}
          </span>
          <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
        </div>
      </div>

      {/* Onboarding hint */}
      {!hintsDismissed && forged.length <= 5 && (
        <div className="hint-box">
          💡 <strong>First time?</strong> You start with 5 pre-forged cards (marked ★).
          Select a slot → pick a card → repeat for all 5 → click FIGHT.
          <span className="hint-close" onClick={dismissHints}>✕</span>
        </div>
      )}

      {/* Saved squads */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.12em' }}>SAVED:</span>
        {savedSquads.length === 0 && (
          <span style={{ fontSize: 8, color: 'var(--muted)' }}>No saves yet</span>
        )}
        {savedSquads.map((sq, i) => (
          <div
            key={i}
            onClick={() => handleLoad(i)}
            style={{
              background: 'var(--panel2)', border: '1px solid var(--blue)',
              padding: '3px 8px', fontSize: 8, cursor: 'pointer',
              display: 'flex', gap: 5, alignItems: 'center', transition: 'all 0.1s',
            }}
          >
            <span>{sq.name}</span>
            <span
              style={{ color: 'var(--muted)', cursor: 'pointer', fontSize: 9 }}
              onClick={e => { e.stopPropagation(); deleteSquad(i) }}
            >✕</span>
          </div>
        ))}
      </div>

      {/* Squad slots */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 7 }}>
        {buildSlots.map((unit, i) => {
          const isActive = activeSlot === i
          const isFilled = !!unit
          const rc = unit ? rarColor((unit as Unit).power.rarity ?? 'common') : 'var(--border)'
          return (
            <div
              key={i}
              onClick={() => { setActiveSlot(i); setSelPowerId(null) }}
              style={{
                background: 'var(--panel)',
                border: `2px solid ${isActive ? 'var(--accent2)' : isFilled ? 'var(--blue)' : 'var(--border)'}`,
                padding: 11, minHeight: 145, position: 'relative',
                cursor: 'pointer', transition: 'border-color 0.14s',
                boxShadow: isActive ? '0 0 10px rgba(255,184,0,0.18)' : 'none',
              }}
            >
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif",
                fontSize: 28, color: 'var(--border)', lineHeight: 1, marginBottom: 2,
              }}>
                0{i + 1}
              </div>

              {!isFilled && (
                <div style={{ color: 'var(--muted)', fontSize: 7, letterSpacing: '0.13em' }}>
                  TAP TO SELECT
                </div>
              )}

              {isFilled && unit && (
                <>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--text)', marginBottom: 2 }}>
                    {(unit as Unit).icon} {(unit as Unit).name}
                  </div>
                  <span style={{
                    display: 'inline-block', fontSize: 7, padding: '1px 4px', margin: '1px 0',
                    border: `1px solid ${rc}`, color: rc,
                  }}>
                    {(unit as Unit).power.icon} {(unit as Unit).power.name}
                  </span>
                  <div style={{ fontSize: 7, color: 'var(--accent)', marginTop: 2 }}>
                    {(unit as Unit).downside.icon} {(unit as Unit).downside.name}
                  </div>
                  <div style={{ fontSize: 6, color: rc, marginTop: 2 }}>
                    {rarLabel((unit as Unit).power.rarity ?? 'common')}
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setBuildSlot(i, null) }}
                    style={{
                      position: 'absolute', top: 5, right: 5,
                      background: 'none', border: '1px solid var(--border)',
                      color: 'var(--muted)', cursor: 'pointer',
                      fontSize: 9, padding: '1px 5px',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}
                  >✕</button>
                </>
              )}
            </div>
          )
        })}
      </div>

      {/* Picker + Preview */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, flex: 1 }}>

        {/* Left: Forged power list */}
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '6px 11px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ fontSize: 14, color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif" }}>
              ⚡ FORGED POWERS
            </h3>
            <span style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.1em' }}>
              {visibleForged.length} AVAILABLE
            </span>
          </div>

          {/* Category filters */}
          <div style={{
            display: 'flex', gap: 3, padding: '5px 7px',
            borderBottom: '1px solid var(--border)', flexWrap: 'wrap',
          }}>
            {(['all', ...POWER_CATS] as string[]).map(cat => (
              <div
                key={cat}
                onClick={() => setPowerFilter(cat)}
                style={{
                  fontSize: 7, letterSpacing: '0.07em', padding: '2px 6px',
                  border: `1px solid ${powerFilter === cat ? 'var(--accent2)' : 'var(--border)'}`,
                  color: powerFilter === cat ? 'var(--accent2)' : 'var(--muted)',
                  cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif",
                  background: powerFilter === cat ? 'rgba(255,184,0,0.07)' : 'transparent',
                  transition: 'all 0.1s',
                }}
              >
                {cat.toUpperCase()}
              </div>
            ))}
          </div>

          {/* Cards */}
          <div style={{
            padding: 7, display: 'grid', gridTemplateColumns: '1fr 1fr',
            gap: 5, overflowY: 'auto', maxHeight: 240,
          }}>
            {visibleForged.length === 0 && (
              <div style={{ gridColumn: '1/-1', fontSize: 9, color: 'var(--muted)', padding: 12, textAlign: 'center' }}>
                No forged powers{powerFilter !== 'all' ? ' in this category' : ''} yet.
                <br />
                <span
                  style={{ color: 'var(--accent2)', cursor: 'pointer', textDecoration: 'underline', marginTop: 4, display: 'inline-block' }}
                  onClick={() => setScreen('shop')}
                >
                  Visit the Shop →
                </span>
              </div>
            )}
            {visibleForged.map(entry => {
              const power = ALL_POWERS.find(p => p.id === entry.powerId)
              const curse = ALL_CURSES.find(c => c.id === entry.curseId)
              if (!power || !curse) return null
              const rc = rarColor(power.rarity)
              const isSelected = selPowerId === power.id
              const refs = entry.refinements ?? []
              return (
                <div
                  key={entry.powerId}
                  onClick={() => setSelPowerId(isSelected ? null : power.id)}
                  style={{
                    border: `1px solid ${isSelected ? 'var(--accent3)' : rc}`,
                    padding: '7px 9px', cursor: 'pointer',
                    background: isSelected ? 'rgba(60,255,180,0.06)' : 'transparent',
                    transition: 'all 0.1s', position: 'relative',
                  }}
                >
                  {entry.isStarter && (
                    <span style={{
                      position: 'absolute', top: 3, right: 5,
                      fontSize: 8, color: 'var(--accent3)', opacity: 0.7,
                    }}>★</span>
                  )}
                  <div style={{ fontSize: 6, color: rc, letterSpacing: '0.1em' }}>
                    {rarLabel(power.rarity)}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--accent2)' }}>
                    {power.icon} {power.name}
                  </div>
                  <div style={{ fontSize: 7, color: 'var(--accent)', marginTop: 1 }}>
                    {curse.icon} {curse.name}
                  </div>
                  {refs.length > 0 && (
                    <div style={{ fontSize: 6, color: 'var(--accent3)', marginTop: 1 }}>
                      ⚙ {refs.length} refinement{refs.length > 1 ? 's' : ''}
                    </div>
                  )}
                  <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>
                    {power.desc}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right: Curse + refinement preview */}
        <div style={{
          background: 'var(--panel)', border: '1px solid var(--border)',
          display: 'flex', flexDirection: 'column',
        }}>
          <div style={{
            padding: '6px 11px', borderBottom: '1px solid var(--border)',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <h3 style={{ fontSize: 14, color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif" }}>
              BOUND CURSE
            </h3>
            <span style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.1em' }}>SHOWN ON CARD</span>
          </div>
          <div style={{ padding: '10px 12px', fontSize: 8, color: 'var(--muted)', lineHeight: 1.7, flex: 1, overflowY: 'auto' }}>
            {!selectedPower && (
              <span>Select a forged power to preview its curse here.</span>
            )}
            {selectedPower && selectedCurse && (
              <>
                {/* Power summary */}
                <div style={{ marginBottom: 10, paddingBottom: 8, borderBottom: '1px solid var(--border)' }}>
                  <div style={{ fontSize: 7, color: rarColor(selectedPower.rarity), letterSpacing: '0.13em', marginBottom: 2 }}>
                    {rarLabel(selectedPower.rarity)} · {selectedPower.cat.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--accent2)' }}>
                    {selectedPower.icon} {selectedPower.name}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2, lineHeight: 1.4 }}>
                    {selectedPower.desc}
                  </div>
                  {selectedPower.damage && (
                    <div style={{ fontSize: 7, color: 'var(--text)', marginTop: 3 }}>
                      💥 {selectedPower.damage} dmg · range {selectedPower.range}
                    </div>
                  )}
                  {selectedPower.heal && (
                    <div style={{ fontSize: 7, color: 'var(--accent3)', marginTop: 3 }}>
                      💚 {selectedPower.heal} heal · range {selectedPower.range}
                    </div>
                  )}
                </div>

                {/* Curse */}
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 7, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 3 }}>
                    BOUND CURSE
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: 'var(--accent)' }}>
                    {selectedCurse.icon} {selectedCurse.name}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2, lineHeight: 1.5 }}>
                    {selectedCurse.desc}
                  </div>
                  <div style={{ marginTop: 5, display: 'flex', gap: 3, flexWrap: 'wrap' }}>
                    {selectedCurse.synergy.map(k => (
                      <span key={k} className={`syn-tag ${SYN_TAGS[k]?.cls ?? ''}`}>
                        {SYN_TAGS[k]?.label ?? k}
                      </span>
                    ))}
                  </div>
                  <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 5 }}>
                    Category: <span style={{ color: 'var(--text)' }}>{selectedCurse.cat}</span>
                    {' · '}
                    Rarity: <span style={{ color: rarColor(selectedCurse.rarity) }}>{rarLabel(selectedCurse.rarity)}</span>
                  </div>
                </div>

                {/* Refinements */}
                {selectedRefs.length > 0 && (
                  <div>
                    <div style={{ fontSize: 7, color: 'var(--accent3)', letterSpacing: '0.1em', marginBottom: 4 }}>
                      REFINEMENTS (max 2)
                    </div>
                    {selectedRefs.map(ref => {
                      const applied = (selectedEntry?.refinements ?? []).includes(ref.id)
                      return (
                        <div key={ref.id} style={{
                          display: 'flex', alignItems: 'center', gap: 5,
                          marginBottom: 4, fontSize: 8,
                          color: applied ? 'var(--accent3)' : 'var(--muted)',
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: applied ? 'var(--accent3)' : 'var(--muted)',
                            flexShrink: 0,
                          }} />
                          <span>{ref.name} — <span style={{ fontSize: 7 }}>{ref.desc}</span></span>
                        </div>
                      )
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Action bar */}
      <div style={{ display: 'flex', gap: 7, alignItems: 'center', flexWrap: 'wrap' }}>
        <button
          className="btn btn-confirm"
          disabled={activeSlot === null || !selPowerId}
          onClick={handleAssign}
        >
          + ASSIGN
        </button>

        <div style={{ fontSize: 9, color: 'var(--muted)', flex: 1, minWidth: 90 }}>
          {statusLabel}
        </div>

        <input
          value={squadName}
          onChange={e => setSquadName(e.target.value)}
          placeholder="Squad name..."
          style={{
            background: 'var(--panel)', border: '1px solid var(--border)',
            color: 'var(--text)', padding: '5px 9px', fontSize: 9,
            fontFamily: "'Share Tech Mono', monospace", width: 110,
            outline: 'none',
          }}
        />
        <button className="btn btn-gold" onClick={handleSave} disabled={filled === 0}>
          💾 SAVE
        </button>

        <button
          className="btn btn-primary"
          disabled={!canLaunch}
          onClick={handleLaunch}
        >
          ▶ FIGHT ({filled}/5)
        </button>
      </div>

      {/* Slot fill dots */}
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        {buildSlots.map((u, i) => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: u ? 'var(--accent3)' : 'var(--border)',
            transition: 'background 0.2s',
          }} />
        ))}
        <span style={{ fontSize: 8, color: 'var(--muted)', marginLeft: 4 }}>
          {filled}/5 UNITS ASSIGNED
        </span>
      </div>

    </div>
  )
}