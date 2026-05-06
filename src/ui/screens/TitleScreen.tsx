import React from 'react'
import { useStore } from '@store'
import { save } from '@systems/SaveManager'

export default function TitleScreen(): React.ReactElement {
  const { setScreen, setMode, difficulty, setDifficulty, coins, diamonds } = useStore()

  return (
    <div className="screen" style={{
      alignItems: 'center', justifyContent: 'center',
      minHeight: '100vh', gap: 18, textAlign: 'center', padding: 28,
      background: 'var(--bg)',
    }}>
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

      {/* Difficulty selector */}
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

      {/* Action buttons */}
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

      {/* Currency bar */}
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
