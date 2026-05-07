import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import { isTutorialComplete, resetTutorial } from './tutorial/TutorialManager'
import TutorialScreen from './tutorial/TutorialScreen'
import AuthScreen from './auth/AuthScreen'
import { signOut, pushCloudSave } from '@lib/AuthManager'

export default function TitleScreen(): React.ReactElement {
  const { setScreen, setMode, difficulty, setDifficulty, coins, diamonds, authUser } = useStore()

  const [showTutorial, setShowTutorial] = useState(false)
  const [showAuth,     setShowAuth]     = useState(false)
  const [checked,      setChecked]      = useState(false)
  const [saveMsg,      setSaveMsg]      = useState<string | null>(null)

  useEffect(() => {
    if (!isTutorialComplete()) setShowTutorial(true)
    setChecked(true)
  }, [])

  function handleTutorialComplete() {
    setShowTutorial(false)
    useStore.setState({ coins: useStore.getState().coins, diamonds: useStore.getState().diamonds })
  }

  async function handleSignOut() {
    await signOut()
    setSaveMsg('Signed out.')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  async function handleSyncSave() {
    await pushCloudSave()
    setSaveMsg('✓ Progress synced to cloud!')
    setTimeout(() => setSaveMsg(null), 2000)
  }

  if (!checked) return <div style={{ background: 'var(--bg)', height: '100vh' }} />

  return (
    <>
      {showTutorial && <TutorialScreen onComplete={handleTutorialComplete} />}
      {showAuth     && <AuthScreen onClose={() => setShowAuth(false)} />}

      <div style={{
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        minHeight: '100vh', gap: 18, textAlign: 'center',
        padding: 28, background: 'var(--bg)', pointerEvents: 'all',
      }}>

        {/* Account bar — top right */}
        <div style={{ position: 'absolute', top: 14, right: 16, display: 'flex', gap: 8, alignItems: 'center' }}>
          {authUser ? (
            <>
              <div style={{ fontSize: 9, color: 'var(--accent3)' }}>
                ✓ <span style={{ color: 'var(--text)' }}>{authUser.username}</span>
              </div>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 9, padding: '3px 8px' }}
                onClick={handleSyncSave}
              >
                ☁ SYNC
              </button>
              <button
                className="btn btn-secondary"
                style={{ fontSize: 9, padding: '3px 8px' }}
                onClick={handleSignOut}
              >
                SIGN OUT
              </button>
            </>
          ) : (
            <button
              className="btn btn-secondary"
              style={{ fontSize: 9, padding: '3px 8px' }}
              onClick={() => setShowAuth(true)}
            >
              🔑 SIGN IN / CREATE ACCOUNT
            </button>
          )}
        </div>

        {/* Save message */}
        {saveMsg && (
          <div style={{ position: 'absolute', top: 48, right: 16, fontSize: 9, color: 'var(--accent3)', background: 'var(--panel)', border: '1px solid var(--accent3)', padding: '4px 10px' }}>
            {saveMsg}
          </div>
        )}

        {/* Logo */}
        <div style={{
          fontFamily: "'Bebas Neue', sans-serif",
          fontSize: 'clamp(48px, 10vw, 100px)', lineHeight: 0.88,
          background: 'linear-gradient(135deg, #ff3c3c, #ffb800, #ff3c3c)',
          WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          backgroundClip: 'text', filter: 'drop-shadow(0 0 36px rgba(255,60,60,0.4))',
        }}>
          CURSED<br />SQUAD
        </div>

        <div style={{ fontSize: 10, color: 'var(--accent2)', letterSpacing: '0.4em', border: '1px solid var(--accent2)', padding: '3px 12px' }}>
          v1.0 · {authUser ? `SIGNED IN AS ${authUser.username.toUpperCase()}` : 'PLAYING AS GUEST'}
        </div>

        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: 15, color: 'var(--accent3)', maxWidth: 400, lineHeight: 1.5 }}>
          Power demands a price. Your legend is forged in the choices others refuse.
        </div>

        {/* Guest notice */}
        {!authUser && (
          <div style={{
            background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)',
            padding: '8px 16px', maxWidth: 380, fontSize: 9, color: 'var(--muted)', lineHeight: 1.6,
          }}>
            Playing as guest — progress saves locally on this device.{' '}
            <span style={{ color: 'var(--accent2)', cursor: 'pointer' }} onClick={() => setShowAuth(true)}>
              Create a free account
            </span>
            {' '}to sync across devices and unlock ranked multiplayer.
          </div>
        )}

        {/* Difficulty */}
        <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>DIFFICULTY:</span>
          {(['easy', 'standard', 'hard'] as const).map(d => (
            <div key={d} className={`diff-badge diff-${d}${difficulty === d ? ' active' : ''}`} onClick={() => setDifficulty(d)}>
              {d.toUpperCase()}
            </div>
          ))}
        </div>

        {/* Main buttons */}
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'center' }}>
          <button className="btn btn-primary" onClick={() => { setMode('campaign'); setScreen('build') }}>🏕 CAMPAIGN</button>
          <button className="btn btn-secondary" onClick={() => { setMode('quick'); setScreen('build') }}>⚔ QUICK BATTLE</button>
          <button className="btn btn-gold" onClick={() => setScreen('shop')}>🛒 SHOP</button>
          <button className="btn btn-purple" onClick={() => setScreen('collection')}>📁 COLLECTION</button>
        </div>

        {/* Coming soon */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'center' }}>
          <div style={{ fontSize: 9, padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em' }}>
            ⚔ RANKED PvP — COMING SOON
          </div>
          <div style={{ fontSize: 9, padding: '4px 12px', border: '1px solid var(--border)', color: 'var(--muted)', fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em' }}>
            🔮 EVENTS — COMING SOON
          </div>
        </div>

        {/* Currency */}
        <div className="cur-bar">
          <div className="cur-item"><span className="cur-icon">🪙</span><span className="cur-val">{coins}</span><span className="cur-label">COINS</span></div>
          <div className="cur-item"><span className="cur-icon">💎</span><span className="cur-val">{diamonds}</span><span className="cur-label">DIAMONDS</span></div>
        </div>

        {/* Footer links */}
        <div style={{ display: 'flex', gap: 16, fontSize: 9, color: 'var(--muted)' }}>
          <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={() => { resetTutorial(); setShowTutorial(true) }}>
            Replay tutorial
          </span>
          {!authUser && (
            <span style={{ cursor: 'pointer', textDecoration: 'underline', color: 'var(--accent2)' }} onClick={() => setShowAuth(true)}>
              Sign in / Create account
            </span>
          )}
        </div>

      </div>
    </>
  )
}