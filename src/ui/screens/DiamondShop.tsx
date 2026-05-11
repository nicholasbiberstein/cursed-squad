import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import { isLoggedIn, getCurrentUser } from '@lib/AuthManager'

// ============================================================
// DIAMOND SHOP
// ============================================================

const PACKS = [
  {
    id:       'starter',
    diamonds: 10,
    price:    '$0.99',
    label:    'STARTER',
    icon:     '💎',
    bonus:    null,
    color:    'var(--r-common)',
    desc:     'Good for a single legendary power.',
  },
  {
    id:       'standard',
    diamonds: 60,
    price:    '$4.99',
    label:    'STANDARD',
    icon:     '💎💎',
    bonus:    '+20% bonus',
    color:    'var(--r-rare)',
    desc:     'Enough for 5 legendary powers with rerolls.',
    popular:  true,
  },
  {
    id:       'value',
    diamonds: 130,
    price:    '$9.99',
    label:    'VALUE',
    icon:     '💎💎💎',
    bonus:    '+30% bonus',
    color:    'var(--r-epic)',
    desc:     'Great for building a full legendary squad.',
  },
  {
    id:       'pro',
    diamonds: 280,
    price:    '$19.99',
    label:    'PRO',
    icon:     '💎💎💎💎',
    bonus:    '+40% bonus',
    color:    'var(--r-legendary)',
    desc:     'Maximum value. Reroll everything.',
  },
  {
    id:       'elite',
    diamonds: 650,
    price:    '$49.99',
    label:    'ELITE',
    icon:     '💎💎💎💎💎',
    bonus:    '+50% bonus',
    color:    'var(--r-mythical)',
    desc:     'For serious commanders. Unlock every legendary.',
  },
  {
    id:       'legend',
    diamonds: 1400,
    price:    '$99.99',
    label:    'LEGEND',
    icon:     '♾',
    bonus:    '+60% bonus — BEST VALUE',
    color:    'var(--accent2)',
    desc:     'The ultimate pack. Never run out of diamonds.',
    best:     true,
  },
]

interface Props {
  onClose:     () => void
  onNeedLogin: () => void
}

export default function DiamondShop({ onClose, onNeedLogin }: Props) {
  const { diamonds, authUser } = useStore()
  const [loading, setLoading] = useState<string | null>(null)
  const [error,   setError]   = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const purchase = params.get('purchase')
    const gems     = params.get('diamonds')
    if (purchase === 'success' && gems) {
      setSuccess(`✓ Purchase complete! +${gems} 💎 added to your account.`)
      window.history.replaceState({}, '', window.location.pathname)
      // Wait for auth to be ready then pull latest save
      const tryPull = async () => {
        const { pullCloudSave } = await import('@lib/AuthManager')
        await pullCloudSave()
        // Force store refresh
        const { save } = await import('@systems/SaveManager')
        useStore.setState({ diamonds: save.diamonds, coins: save.coins })
      }
      // Retry a couple times to handle auth timing
      setTimeout(tryPull, 500)
      setTimeout(tryPull, 2000)
      setTimeout(tryPull, 4000)
    }
    if (purchase === 'cancelled') {
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  async function handlePurchase(packId: string) {
    if (!isLoggedIn() || !authUser) { onNeedLogin(); return }
    setLoading(packId); setError(null)
    try {
      const res = await fetch('/api/create-checkout', {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packId, userId: authUser.id, userEmail: authUser.email }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(null); return }
      window.location.href = data.url
    } catch {
      setError('Network error — please try again.')
      setLoading(null)
    }
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.92)',
      display: 'flex', alignItems: 'flex-start', justifyContent: 'center',
      zIndex: 3000, padding: '16px 16px 40px', pointerEvents: 'all',
      overflowY: 'auto',
    }}>
      <div style={{ maxWidth: 620, width: '100%', display: 'flex', flexDirection: 'column', gap: 14, paddingTop: 8 }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', position: 'sticky', top: 0, background: 'rgba(0,0,0,0.92)', padding: '8px 0', zIndex: 10 }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: 'var(--purple)' }}>
            💎 DIAMOND SHOP
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--purple)' }}>
              {diamonds} 💎
            </div>
            <span style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 20, lineHeight: 1 }} onClick={onClose}>✕</span>
          </div>
        </div>

        <div style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em', marginTop: -8 }}>
          SECURE CHECKOUT VIA STRIPE · DIAMONDS NEVER EXPIRE · ALL SALES FINAL
        </div>

        {/* Not logged in */}
        {!authUser && (
          <div style={{ background: 'rgba(255,184,0,0.08)', border: '1px solid rgba(255,184,0,0.3)', padding: '12px 16px', fontSize: 10, color: 'var(--accent2)', lineHeight: 1.6 }}>
            ⚠ You need a free account to purchase diamonds.{' '}
            <span style={{ cursor: 'pointer', textDecoration: 'underline' }} onClick={onNeedLogin}>Sign in or create account →</span>
          </div>
        )}

        {/* Success */}
        {success && (
          <div style={{ background: 'rgba(60,255,180,0.08)', border: '1px solid var(--accent3)', padding: '12px 16px', fontSize: 11, color: 'var(--accent3)' }}>
            {success}
          </div>
        )}

        {/* Error */}
        {error && (
          <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid var(--accent)', padding: '12px 16px', fontSize: 10, color: 'var(--accent)' }}>
            ⚠ {error}
          </div>
        )}

        {/* Pack grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          {PACKS.map(pack => (
            <div
              key={pack.id}
              style={{
                background: 'var(--panel)',
                border: `2px solid ${(pack as any).best ? 'var(--accent2)' : (pack as any).popular ? 'var(--purple)' : 'var(--border)'}`,
                padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 7,
                position: 'relative',
                boxShadow: (pack as any).best ? '0 0 20px rgba(255,184,0,0.15)' : (pack as any).popular ? '0 0 12px rgba(192,60,255,0.12)' : 'none',
              }}
            >
              {/* Badge */}
              {((pack as any).best || (pack as any).popular) && (
                <div style={{
                  position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                  background: (pack as any).best ? 'var(--accent2)' : 'var(--purple)',
                  color: (pack as any).best ? '#000' : '#fff',
                  fontSize: 8, padding: '2px 10px',
                  fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.12em', whiteSpace: 'nowrap',
                }}>
                  {(pack as any).best ? '★ BEST VALUE' : 'MOST POPULAR'}
                </div>
              )}

              <div style={{ fontSize: 20 }}>{pack.icon}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: pack.color }}>{pack.label}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--purple)', lineHeight: 1 }}>
                {pack.diamonds}
                <span style={{ fontSize: 11, color: 'var(--muted)', marginLeft: 4 }}>💎</span>
              </div>
              {pack.bonus && (
                <div style={{ fontSize: 8, color: 'var(--accent3)', letterSpacing: '0.08em' }}>✓ {pack.bonus}</div>
              )}
              <div style={{ fontSize: 9, color: 'var(--muted)', lineHeight: 1.5, flex: 1 }}>{pack.desc}</div>
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 9, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--accent2)' }}>{pack.price}</div>
                <button
                  className="btn btn-purple"
                  style={{ fontSize: 11, padding: '5px 12px' }}
                  disabled={!!loading || !authUser}
                  onClick={() => handlePurchase(pack.id)}
                >
                  {loading === pack.id ? '...' : 'BUY'}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* What diamonds buy */}
        <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '12px 16px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 8 }}>WHAT DIAMONDS ARE USED FOR</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
            {[
              ['💎 12',   'Legendary power (Shop)'],
              ['💎 1-8',  'Curse reroll (Collection)'],
              ['💎 Free', 'Earn from campaign wins'],
              ['💎 Free', 'Earn from battle rewards'],
              ['🔮 Soon', 'Event entry passes'],
              ['🎨 Soon', 'Cosmetic skins'],
            ].map(([cost, desc]) => (
              <div key={desc} style={{ fontSize: 9, color: 'var(--muted)', display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--purple)', minWidth: 52 }}>{cost}</span>
                <span>{desc}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Legal */}
        <div style={{ fontSize: 8, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.6 }}>
          Payments processed securely by Stripe. Diamonds are virtual currency with no real-world value.
          All purchases are final. By purchasing you agree to our Terms of Service.
        </div>

      </div>
    </div>
  )
}