import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import { isTutorialComplete, resetTutorial } from './tutorial/TutorialManager'
import TutorialScreen from './tutorial/TutorialScreen'

export default function TitleScreen(): React.ReactElement {
  const { setScreen, setMode, difficulty, setDifficulty, coins, diamonds } = useStore()

  // Show tutorial on first launch
  const [showTutorial, setShowTutorial] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    if (!isTutorialComplete()) {
      setShowTutorial(true)
    }
    setChecked(true)
  }, [])

  function handleTutorialComplete() {
    setShowTutorial(false)
    // Refresh currency display after reward
    useStore.setState({ coins: (window as any).__save?.coins ?? useStore.getState().coins })
  }

  if (!checked) return <div style={{ background: 'var(--bg)', height: '100vh' }} />

  return (
    <>
      {showTutorial && (
        <TutorialScreen onComplete={handleTutorialComplete} />
      )}

      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', gap: 18, textAlign: 'center',
        padding: 28, background: 'var(--bg)', pointerEvents: 'all',
      }}>

        {/* Logo */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(48px, 10vw, 100px)',
          lineHeight: 0.88,
          background: 'linear-gradient(135deg, #ff3c3c, #ffb800, #ff3c3c)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          filter: 'drop-shadow(0 0 36px rgba(255,60,60,0.4))',
        }}>
          CURSED<br />SQUAD
        </div>

        <div style={{ fontSize: 10, color: 'var(--accent2)', letterSpacing: '0.4em', border: '1px solid var(--accent2)', padding: '3px 12px' }}>
          v1.0 — REACT + PHASER
        </div>

        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'var(--accent3)', maxWidth: 400, lineHeight: 1.5 }}>
          Power demands a price. Your legend is forged in the choices others refuse.
        </div>

        {/* Difficulty */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>DIFFICULTY:</span>
          {(['easy', 'standard', 'hard'] as const).map(d => (
            <div
              key={d}
              className={`diff-badge diff-${d}${difficulty === d ? ' active' : ''}`}
              onClick={() => setDifficulty(d)}
            >
              {d.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => { setMode('campaign'); setScreen('build') }}>
            🏕 CAMPAIGN
          </button>
          <button className="btn btn-secondary" onClick={() => { setMode('quick'); setScreen('build') }}>
            ⚔ QUICK BATTLE
          </button>
          <button className="btn btn-gold" onClick={() => setScreen('shop')}>
            🛒 SHOP
          </button>
          <button className="btn btn-purple" onClick={() => setScreen('collection')}>
            📁 COLLECTION
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

        {/* Replay tutorial link */}
        <div
          style={{ fontSize: 9, color: 'var(--muted)', cursor: 'pointer', textDecoration: 'underline', marginTop: -8 }}
          onClick={() => { resetTutorial(); setShowTutorial(true) }}
        >
          Replay tutorial
        </div>

      </div>
    </>
  )
}