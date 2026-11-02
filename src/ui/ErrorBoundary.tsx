import React from 'react'

// ============================================================
// ERROR BOUNDARY + FATAL SCREEN
// Without this, any uncaught error blanks the whole app to the
// near-black page background. This shows a readable message and
// a way out (reload, or wipe local save data for this game only).
// ============================================================

const SAVE_PREFIXES = ['cs_']

function resetSaveData(): void {
  try {
    const keys: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (k && SAVE_PREFIXES.some(p => k.startsWith(p))) keys.push(k)
    }
    keys.forEach(k => localStorage.removeItem(k))
  } catch { /* storage unavailable */ }
  window.location.reload()
}

export function FatalScreen({ error }: { error: unknown }) {
  const message = error instanceof Error ? error.message : String(error)
  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center', gap: 16,
      padding: 24, background: '#07070d', color: '#e8e8f0',
      fontFamily: "'Share Tech Mono', monospace", textAlign: 'center',
    }}>
      <div style={{ fontSize: 22, letterSpacing: 2, color: '#ff3c3c' }}>SOMETHING WENT WRONG</div>
      <div style={{ maxWidth: 420, fontSize: 13, opacity: 0.8 }}>
        The game hit an error and could not continue. Reloading usually fixes it.
        If it keeps happening, resetting local save data clears a corrupted save
        (coins, diamonds and cards stored on this device will be lost).
      </div>
      <code style={{ maxWidth: 420, fontSize: 11, opacity: 0.55, wordBreak: 'break-word' }}>{message}</code>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        <button onClick={() => window.location.reload()}
          style={{ padding: '10px 18px', background: '#3c8fff', color: '#fff', border: 0, cursor: 'pointer' }}>
          RELOAD
        </button>
        <button onClick={() => { if (window.confirm('Erase local save data for this game?')) resetSaveData() }}
          style={{ padding: '10px 18px', background: 'transparent', color: '#ff3c3c', border: '1px solid #ff3c3c', cursor: 'pointer' }}>
          RESET SAVE DATA
        </button>
      </div>
    </div>
  )
}

interface State { error: unknown | null }

export default class ErrorBoundary extends React.Component<{ children: React.ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: unknown): State {
    return { error }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo) {
    console.error('Cursed Squad crashed:', error, info.componentStack)
  }

  render() {
    if (this.state.error !== null) return <FatalScreen error={this.state.error} />
    return this.props.children
  }
}
