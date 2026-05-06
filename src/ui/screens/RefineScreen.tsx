import React from 'react'
import { useStore } from '@store'

// TODO: Full RefineScreen implementation — ported from v0.65 HTML prototype
export default function RefineScreen(): React.ReactElement {
  const { setScreen } = useStore()
  return (
    <div className="screen" style={{ padding: 20, background: 'var(--bg)', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
      <div style={{ textAlign: 'center', color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 32 }}>
        RefineScreen
      </div>
      <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 8 }}>
        Full implementation in next update — ported from v0.65 HTML prototype
      </div>
      <button className="btn btn-secondary" style={{ marginTop: 16 }} onClick={() => setScreen('title')}>
        ← BACK
      </button>
    </div>
  )
}
