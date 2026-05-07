import React, { useState } from 'react'
import { signIn, signUp, resetPassword } from '@lib/AuthManager'
import { useStore } from '@store'

// ============================================================
// AUTH SCREEN
// Sign in / Sign up / Forgot password
// Accessible from TitleScreen via Account button.
// Guest play always available — auth is optional.
// ============================================================

type AuthMode = 'signin' | 'signup' | 'forgot' | 'forgot_sent'

interface Props {
  onClose: () => void
}

export default function AuthScreen({ onClose }: Props) {
  const [mode,     setMode]     = useState<AuthMode>('signin')
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [username, setUsername] = useState('')
  const [confirm,  setConfirm]  = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [success,  setSuccess]  = useState<string | null>(null)

  const inputStyle: React.CSSProperties = {
    background: 'var(--panel2)', border: '1px solid var(--border)',
    color: 'var(--text)', padding: '10px 14px', fontSize: 12,
    fontFamily: "'Share Tech Mono', monospace", width: '100%',
    outline: 'none', transition: 'border-color 0.12s',
  }

  const labelStyle: React.CSSProperties = {
    fontSize: 8, color: 'var(--muted)', letterSpacing: '0.14em',
    display: 'block', marginBottom: 4,
  }

  async function handleSignIn() {
    if (!email || !password) { setError('Please fill in all fields.'); return }
    setLoading(true); setError(null)
    const { error } = await signIn(email, password)
    setLoading(false)
    if (error) { setError(error); return }
    setSuccess('Signed in! Your progress is synced.')
    setTimeout(onClose, 1200)
  }

  async function handleSignUp() {
    if (!email || !password || !username) { setError('Please fill in all fields.'); return }
    if (password !== confirm) { setError('Passwords do not match.'); return }
    if (password.length < 6) { setError('Password must be at least 6 characters.'); return }
    if (username.length < 3) { setError('Username must be at least 3 characters.'); return }
    setLoading(true); setError(null)
    const { error } = await signUp(email, password, username)
    setLoading(false)
    if (error) { setError(error); return }
    setSuccess('Account created! Check your email to confirm.')
    setTimeout(onClose, 2000)
  }

  async function handleForgot() {
    if (!email) { setError('Enter your email address.'); return }
    setLoading(true); setError(null)
    const { error } = await resetPassword(email)
    setLoading(false)
    if (error) { setError(error); return }
    setMode('forgot_sent')
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 3000, padding: 24, pointerEvents: 'all',
    }}>
      <div style={{
        background: 'var(--panel)', border: '2px solid var(--border)',
        padding: '28px 32px', maxWidth: 400, width: '100%',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent2)' }}>
              {mode === 'signin'      && '🔑 SIGN IN'}
              {mode === 'signup'      && '⚡ CREATE ACCOUNT'}
              {mode === 'forgot'      && '🔒 RESET PASSWORD'}
              {mode === 'forgot_sent' && '📧 CHECK YOUR EMAIL'}
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 3, lineHeight: 1.5 }}>
              {mode === 'signin'      && 'Your progress syncs across devices when signed in.'}
              {mode === 'signup'      && 'Free account. Guest play always available.'}
              {mode === 'forgot'      && "We'll send a reset link to your email."}
              {mode === 'forgot_sent' && 'A password reset link has been sent.'}
            </div>
          </div>
          <span style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 16, marginLeft: 12 }} onClick={onClose}>✕</span>
        </div>

        {/* Success */}
        {success && (
          <div style={{ background: 'rgba(60,255,180,0.08)', border: '1px solid var(--accent3)', padding: '10px 14px', fontSize: 10, color: 'var(--accent3)', lineHeight: 1.5 }}>
            ✓ {success}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid var(--accent)', padding: '10px 14px', fontSize: 10, color: 'var(--accent)', lineHeight: 1.5 }}>
            ⚠ {error}
          </div>
        )}

        {/* Forgot sent */}
        {mode === 'forgot_sent' && (
          <>
            <div style={{ fontSize: 11, color: 'var(--muted)', lineHeight: 1.7 }}>
              Check your inbox for a password reset link. It may take a minute to arrive.
            </div>
            <button className="btn btn-secondary" onClick={() => setMode('signin')}>← BACK TO SIGN IN</button>
          </>
        )}

        {/* Sign in form */}
        {mode === 'signin' && (
          <>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
            </div>
            <div>
              <label style={labelStyle}>PASSWORD</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignIn()} />
            </div>
            <button className="btn btn-primary" style={{ fontSize: 16 }} disabled={loading} onClick={handleSignIn}>
              {loading ? 'SIGNING IN...' : 'SIGN IN'}
            </button>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 9, color: 'var(--muted)' }}>
              <span style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => { setMode('signup'); setError(null) }}>
                Create account →
              </span>
              <span style={{ cursor: 'pointer' }} onClick={() => { setMode('forgot'); setError(null) }}>
                Forgot password?
              </span>
            </div>
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, fontSize: 9, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
              <strong style={{ color: 'var(--text)' }}>Playing as guest?</strong> That's fine — your progress saves locally.
              Create an account to sync across devices and access ranked multiplayer when it launches.
            </div>
          </>
        )}

        {/* Sign up form */}
        {mode === 'signup' && (
          <>
            <div>
              <label style={labelStyle}>USERNAME</label>
              <input style={inputStyle} type="text" value={username} onChange={e => setUsername(e.target.value)} placeholder="YourCallsign" maxLength={20} />
              <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>This is how other players will see you in multiplayer.</div>
            </div>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" />
            </div>
            <div>
              <label style={labelStyle}>PASSWORD</label>
              <input style={inputStyle} type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 6 characters" />
            </div>
            <div>
              <label style={labelStyle}>CONFIRM PASSWORD</label>
              <input style={inputStyle} type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="••••••••" onKeyDown={e => e.key === 'Enter' && handleSignUp()} />
            </div>
            <button className="btn btn-confirm" style={{ fontSize: 16 }} disabled={loading} onClick={handleSignUp}>
              {loading ? 'CREATING ACCOUNT...' : 'CREATE ACCOUNT'}
            </button>
            <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center' }}>
              <span style={{ cursor: 'pointer', color: 'var(--accent2)' }} onClick={() => { setMode('signin'); setError(null) }}>
                ← Already have an account?
              </span>
            </div>
            <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.6, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
              By creating an account you agree to our Terms of Service and Privacy Policy (coming soon). Your local progress will be merged with your new account.
            </div>
          </>
        )}

        {/* Forgot password form */}
        {mode === 'forgot' && (
          <>
            <div>
              <label style={labelStyle}>EMAIL</label>
              <input style={inputStyle} type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="your@email.com" onKeyDown={e => e.key === 'Enter' && handleForgot()} />
            </div>
            <button className="btn btn-gold" style={{ fontSize: 16 }} disabled={loading} onClick={handleForgot}>
              {loading ? 'SENDING...' : 'SEND RESET LINK'}
            </button>
            <span style={{ fontSize: 9, color: 'var(--accent2)', cursor: 'pointer' }} onClick={() => { setMode('signin'); setError(null) }}>
              ← Back to sign in
            </span>
          </>
        )}

      </div>
    </div>
  )
}