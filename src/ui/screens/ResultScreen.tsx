import React, { useEffect, useState } from 'react'
import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, rarLabel } from '@data/rarity'
import { getDiffConfig } from '@data/difficulty'
import { save } from '@systems/SaveManager'
import type { Unit } from '@data/types'

export default function ResultScreen(): React.ReactElement {
  const {
    setScreen, setMode,
    units, round, mode, difficulty,
    savedSquad, setSavedSquad,
    buildSlots, setBuildSlot,
    campWave, setCampWave, setCampUnits,
    addCoins,
  } = useStore()

  const [saveConfirm, setSaveConfirm] = useState(false)
  const [revealed, setRevealed] = useState(false)

  const win = useStore(s => s.units.filter(u => u.team === 'enemy' && u.hp > 0).length === 0)
  const campaignComplete = mode === 'campaign' && win && campWave >= 3

  const dc = getDiffConfig(difficulty)
  const baseCoin = win ? (38 + Math.floor(Math.random() * 28)) : (14 + Math.floor(Math.random() * 14))
  const [coinReward]    = useState(Math.round(baseCoin * dc.rewardMult))
  const [diamondReward] = useState(win && Math.random() < 0.2 ? 1 : 0)
  const [campBonus]     = useState(campaignComplete ? 120 : 0)

  const playerUnits = units.filter(u => u.team === 'player')
  const enemyUnits  = units.filter(u => u.team === 'enemy')

  // Animate in
  useEffect(() => {
    const t = setTimeout(() => setRevealed(true), 120)
    return () => clearTimeout(t)
  }, [])

  function handleSaveSquad() {
    if (!savedSquad) return
    save.squads.push({ name: `Squad ${save.squads.length + 1}`, slots: savedSquad })
    save.persistSquads()
    useStore.setState({ savedSquads: [...save.squads] })
    setSaveConfirm(true)
  }

  function handleNewSquad() {
    Array(5).fill(null).forEach((_, i) => setBuildSlot(i, null))
    setMode('quick')
    setScreen('build')
  }

  function handleRematch() {
    if (!savedSquad) { handleNewSquad(); return }
    savedSquad.forEach((u, i) => setBuildSlot(i, u))
    setScreen('build')
  }

  function handleContinueCampaign() {
    setScreen('inter')
  }

  function handleNewCampaign() {
    setCampWave(0)
    setCampUnits(null)
    Array(5).fill(null).forEach((_, i) => setBuildSlot(i, null))
    setMode('campaign')
    setScreen('build')
  }

  const titleText = campaignComplete
    ? 'CAMPAIGN\nCLEAR!'
    : win ? 'VICTORY' : 'DEFEAT'

  const subText = campaignComplete
    ? 'ALL THREE BATTLES CONQUERED. YOUR FORGED LEGEND IS COMPLETE.'
    : win
    ? 'Your cursed squad conquered the field.'
    : `${enemyUnits.filter(u => u.hp > 0).length} enemies remain. Forge smarter.`

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      alignItems: 'center',
      minHeight: '100vh', height: '100vh',
      gap: 16, textAlign: 'center',
      padding: '40px 28px', background: 'var(--bg)',
      pointerEvents: 'all', overflowY: 'auto',
      opacity: revealed ? 1 : 0,
      transition: 'opacity 0.4s ease',
    }}>

      {/* ── TITLE ── */}
      <div style={{
        fontFamily: "'Bebas Neue', sans-serif",
        fontSize: campaignComplete ? 64 : 78,
        lineHeight: 1, letterSpacing: '0.02em',
        color: win ? 'var(--accent3)' : 'var(--accent)',
        filter: `drop-shadow(0 0 26px ${win ? 'rgba(60,255,180,0.5)' : 'rgba(255,60,60,0.5)'})`,
        whiteSpace: 'pre-line',
      }}>
        {titleText}
      </div>

      {/* ── SUBTITLE ── */}
      <div style={{ fontSize: 10, color: 'var(--muted)', letterSpacing: '0.14em', maxWidth: 380 }}>
        {subText}
      </div>

      {/* ── DIFFICULTY BADGE ── */}
      <div style={{
        fontSize: 9, letterSpacing: '0.15em', padding: '2px 10px',
        border: `1px solid ${dc.label === 'EASY' ? 'var(--accent3)' : dc.label === 'HARD' ? 'var(--accent)' : 'var(--accent2)'}`,
        color: dc.label === 'EASY' ? 'var(--accent3)' : dc.label === 'HARD' ? 'var(--accent)' : 'var(--accent2)',
        fontFamily: "'Bebas Neue', sans-serif",
      }}>
        {dc.label} DIFFICULTY · ROUND {round}
      </div>

      {/* ── REWARDS ── */}
      <div style={{
        background: 'var(--panel)', border: '1px solid var(--accent2)',
        padding: '10px 22px', display: 'flex', gap: 18,
        alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center',
      }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 22 }}>🪙</div>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)' }}>
            +{coinReward + campBonus}
          </div>
          <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.1em' }}>
            COINS{campBonus > 0 ? ' + BONUS' : ''}
          </div>
        </div>

        {(diamondReward > 0 || campaignComplete) && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>💎</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)' }}>
              +{diamondReward + (campaignComplete ? 2 : 0)}
            </div>
            <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.1em' }}>DIAMONDS</div>
          </div>
        )}

        {campaignComplete && (
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: 22 }}>🏆</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)' }}>
              LEGEND
            </div>
            <div style={{ fontSize: 7, color: 'var(--muted)', letterSpacing: '0.1em' }}>CAMPAIGN</div>
          </div>
        )}
      </div>

      {/* ── YOUR SQUAD RECAP ── */}
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 6 }}>
          YOUR SQUAD
        </div>
        <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
          {playerUnits.map(u => {
            const alive = u.hp > 0
            return (
              <div key={u.id} style={{
                background: 'var(--panel)',
                border: `1px solid ${alive ? 'var(--blue)' : 'var(--border)'}`,
                padding: '6px 10px', fontSize: 8, textAlign: 'center',
                opacity: alive ? 1 : 0.4, minWidth: 80,
              }}>
                <div style={{ fontSize: 16 }}>{u.icon}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color: alive ? 'var(--blue)' : 'var(--muted)' }}>
                  {u.name}
                </div>
                <div style={{ color: 'var(--accent2)', fontSize: 7, marginTop: 2 }}>
                  {u.power.icon} {u.power.name}
                </div>
                <div style={{ color: 'var(--accent)', fontSize: 7 }}>
                  {u.downside.icon} {u.downside.name}
                </div>
                <div style={{ color: alive ? 'var(--accent3)' : 'var(--muted)', fontSize: 7, marginTop: 2 }}>
                  {alive ? `${u.hp}/${u.maxHp} HP` : '✝ FALLEN'}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── ENEMY SQUAD REVEAL ── */}
      <div style={{ maxWidth: 600, width: '100%' }}>
        <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 6 }}>
          ENEMY SQUAD
        </div>
        <div style={{ display: 'flex', gap: 5, justifyContent: 'center', flexWrap: 'wrap' }}>
          {enemyUnits.map(u => (
            <div key={u.id} style={{
              background: 'var(--panel)',
              border: '1px solid var(--accent)',
              padding: '5px 8px', fontSize: 7,
            }}>
              <div>{u.icon} {u.name}</div>
              <div style={{ color: 'var(--accent2)' }}>{u.power.icon} {u.power.name}</div>
              <div style={{ color: 'var(--accent)' }}>{u.downside.icon} {u.downside.name}</div>
              <div style={{ color: u.hp > 0 ? 'var(--accent3)' : 'var(--muted)', marginTop: 2 }}>
                {u.hp > 0 ? `${u.hp}/${u.maxHp} HP` : '✝'}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ── AD SLOT ── */}
      <div id="ad-slot-result" style={{
        height: 60, width: '100%', maxWidth: 600,
        background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.2em',
      }}>
        AD SLOT
      </div>

      {/* ── SAVE SQUAD ── */}
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button className="btn btn-gold" onClick={handleSaveSquad} disabled={saveConfirm}>
          💾 SAVE SQUAD
        </button>
        {saveConfirm && (
          <span style={{ fontSize: 9, color: 'var(--accent3)' }}>✓ SAVED</span>
        )}
      </div>

      {/* ── ACTION BUTTONS ── */}
      <div style={{ display: 'flex', gap: 9, flexWrap: 'wrap', justifyContent: 'center' }}>
        {/* Campaign-specific buttons */}
        {mode === 'campaign' && win && !campaignComplete && (
          <button className="btn btn-primary" onClick={handleContinueCampaign}>
            ▶ NEXT WAVE
          </button>
        )}
        {campaignComplete && (
          <button className="btn btn-primary" onClick={handleNewCampaign}>
            🏕 NEW CAMPAIGN
          </button>
        )}

        {/* Universal buttons */}
        <button className="btn btn-confirm" onClick={handleNewSquad}>
          NEW SQUAD
        </button>
        <button className="btn btn-secondary" onClick={handleRematch}>
          REMATCH
        </button>
        {mode === 'campaign' && !win && (
          <button className="btn btn-purple" onClick={() => setScreen('campaign')}>
            CAMPAIGN
          </button>
        )}
        <button className="btn btn-gold" onClick={() => setScreen('shop')}>
          🛒 SHOP
        </button>
        <button className="btn btn-secondary" onClick={() => setScreen('title')}>
          MENU
        </button>
      </div>

    </div>
  )
}