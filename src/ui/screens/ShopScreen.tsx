import React, { useState } from 'react'
import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { rarColor, rarLabel, POWER_CATS } from '@data/rarity'
import { buyPower, confirmForge, generateCurseOptions } from '@systems/ForgeSystem'
import { save } from '@systems/SaveManager'
import type { Power, Curse } from '@data/types'

type RarFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary'

export default function ShopScreen(): React.ReactElement {
  const { setScreen, forged, addForged, coins, diamonds, spendCoins, spendDiamonds } = useStore()

  const [rarFilter, setRarFilter]   = useState<RarFilter>('all')
  const [catFilter, setCatFilter]   = useState<string>('all')
  const [notification, setNotification] = useState<string | null>(null)

  // Forge flow state
  const [forgingPower,  setForgingPower]  = useState<Power | null>(null)
  const [curseOptions,  setCurseOptions]  = useState<Curse[]>([])
  const [chosenCurse,   setChosenCurse]   = useState<Curse | null>(null)
  const [showForge,     setShowForge]     = useState(false)

  function notify(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 2200)
  }

  // Filter powers — no mythical in shop
  const shopPowers = ALL_POWERS.filter(p => {
    if (p.rarity === 'mythical') return false
    if (rarFilter !== 'all' && p.rarity !== rarFilter) return false
    if (catFilter !== 'all' && p.cat !== catFilter) return false
    return true
  })

  function handleBuy(power: Power) {
    const result = buyPower(power)
    if ('error' in result) { notify(result.error); return }

    // Sync store with updated save
    useStore.setState({ coins: save.coins, diamonds: save.diamonds })

    // Open forge panel
    setForgingPower(power)
    setCurseOptions(result.cursePool)
    setChosenCurse(null)
    setShowForge(true)
  }

  function handleConfirmForge() {
    if (!forgingPower || !chosenCurse) return
    confirmForge(forgingPower.id, chosenCurse.id)
    addForged({ powerId: forgingPower.id, curseId: chosenCurse.id, rerollCount: 0, refinements: [] })
    notify(`⚒ Forged: ${forgingPower.name} + ${chosenCurse.name}!`)
    setShowForge(false)
    setForgingPower(null)
    setChosenCurse(null)
  }

  function handleCancelForge() {
    // Refund the cost
    const rar = forgingPower
    if (rar) {
      const isDia = (rar.rarity === 'legendary')
      if (isDia) save.diamonds += 12
      else {
        const costs: Record<string, number> = { common: 50, rare: 120, epic: 220 }
        save.coins += costs[rar.rarity] ?? 0
      }
      save.persistCoins()
      useStore.setState({ coins: save.coins, diamonds: save.diamonds })
    }
    setShowForge(false)
    setForgingPower(null)
    setChosenCurse(null)
  }

  const SYN_COLORS: Record<string, string> = {
    'high-risk': '#f43', 'positioning': 'var(--blue)', 'unstable': '#f8f',
    'defensive': 'var(--accent3)', 'aggressive': 'var(--accent2)',
    'utility': 'var(--purple)', 'stealth': '#888',
  }
  const SYN_LABELS: Record<string, string> = {
    'high-risk': '🔥 HIGH RISK', 'positioning': '🧭 POSITIONING', 'unstable': '⚠ UNSTABLE',
    'defensive': '🛡 DEFENSIVE', 'aggressive': '⚡ AGGRESSIVE',
    'utility': '🔧 UTILITY', 'stealth': '👻 STEALTH',
  }

  return (
    <div style={{
      flexDirection: 'column',
      overflowY: 'auto', padding: '14px 18px', gap: 12,
      maxWidth: 1100, margin: '0 auto', width: '100%',
      background: 'var(--bg)', display: 'flex',
      height: '100vh', pointerEvents: 'all',
    }}>

      {/* Notification toast */}
      {notification && (
        <div style={{
          position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'var(--panel)', border: '1px solid var(--accent3)',
          color: 'var(--accent3)', padding: '8px 20px', fontSize: 11,
          fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em',
          zIndex: 1000, whiteSpace: 'nowrap',
        }}>
          {notification}
        </div>
      )}

      {/* ── FORGE OVERLAY ── */}
      {showForge && forgingPower && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 18, padding: 28, zIndex: 900,
          overflowY: 'auto',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 36,
              color: 'var(--accent2)',
            }}>⚒ FORGE YOUR POWER</h2>
            <p style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.18em', marginTop: 3 }}>
              CHOOSE A CURSE TO PERMANENTLY BIND
            </p>
          </div>

          {/* Power display */}
          <div style={{
            background: 'var(--panel)',
            border: `2px solid ${rarColor(forgingPower.rarity)}`,
            padding: '13px 20px', textAlign: 'center',
            maxWidth: 320, width: '100%',
          }}>
            <div style={{ fontSize: 9, color: rarColor(forgingPower.rarity), letterSpacing: '0.18em', marginBottom: 2 }}>
              {rarLabel(forgingPower.rarity)} · {forgingPower.cat.toUpperCase()}
            </div>
            <div style={{
              fontFamily: "'Bebas Neue', sans-serif", fontSize: 26,
              color: rarColor(forgingPower.rarity),
            }}>
              {forgingPower.icon} {forgingPower.name}
            </div>
            <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
              {forgingPower.desc}
            </div>
          </div>

          <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', maxWidth: 500 }}>
            This curse is <span style={{ color: 'var(--accent)' }}>permanently bound</span>.
            Reroll later in Collection for 💎 Diamonds.
          </div>

          {/* Curse options */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12, maxWidth: 780, width: '100%',
          }}>
            {curseOptions.map(curse => {
              const isChosen = chosenCurse?.id === curse.id
              return (
                <div
                  key={curse.id}
                  onClick={() => setChosenCurse(curse)}
                  style={{
                    background: isChosen ? 'rgba(60,255,180,0.06)' : 'var(--panel)',
                    border: `2px solid ${isChosen ? 'var(--accent3)' : 'var(--border)'}`,
                    padding: 14, cursor: 'pointer',
                    transition: 'all 0.14s', display: 'flex', flexDirection: 'column', gap: 5,
                  }}
                >
                  <div style={{ fontSize: 7, color: rarColor(curse.rarity), letterSpacing: '0.13em' }}>
                    {rarLabel(curse.rarity)} · {curse.cat.toUpperCase()}
                  </div>
                  <div style={{
                    fontFamily: "'Bebas Neue', sans-serif", fontSize: 18,
                    color: 'var(--accent)',
                  }}>
                    {curse.icon} {curse.name}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.4 }}>
                    {curse.desc}
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 3 }}>
                    {curse.synergy.map(k => (
                      <span key={k} style={{
                        fontSize: 7, padding: '2px 6px',
                        border: `1px solid ${SYN_COLORS[k] ?? 'var(--border)'}`,
                        color: SYN_COLORS[k] ?? 'var(--muted)',
                      }}>
                        {SYN_LABELS[k] ?? k}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {/* Result preview */}
          <div style={{ fontSize: 10, color: 'var(--accent3)', textAlign: 'center', minHeight: 20 }}>
            {chosenCurse
              ? `FORGED: ${forgingPower.icon} ${forgingPower.name} + ${chosenCurse.icon} ${chosenCurse.name}`
              : '— select a curse above —'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-confirm"
              disabled={!chosenCurse}
              onClick={handleConfirmForge}
            >
              ⚒ FORGE IT
            </button>
            <button className="btn btn-secondary" onClick={handleCancelForge}>
              CANCEL (REFUND)
            </button>
          </div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border)', paddingBottom: 10,
        flexWrap: 'wrap', gap: 7,
      }}>
        <h2 style={{ fontSize: 24, color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif" }}>
          🛒 POWER SHOP
        </h2>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
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
          <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--muted)' }}>
        Buy a power → choose its bound curse → added to your Collection. Curses can be rerolled later.
      </div>

      {/* ── AD SLOT (banner) ── */}
      <div id="ad-slot-shop-banner" style={{
        height: 60, background: 'rgba(255,255,255,0.02)',
        border: '1px dashed rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 8, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.2em',
      }}>
        AD SLOT
      </div>

      {/* ── RARITY FILTERS ── */}
      <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>RARITY:</span>
        {(['all', 'common', 'rare', 'epic', 'legendary'] as RarFilter[]).map(r => (
          <div
            key={r}
            onClick={() => setRarFilter(r)}
            style={{
              fontSize: 8, letterSpacing: '0.08em', padding: '2px 9px',
              border: `1px solid ${rarFilter === r ? rarColor(r as any) : 'var(--border)'}`,
              color: rarFilter === r ? rarColor(r as any) : 'var(--muted)',
              cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif",
              background: rarFilter === r ? `${rarColor(r as any)}15` : 'transparent',
              transition: 'all 0.1s',
            }}
          >
            {r.toUpperCase()}
          </div>
        ))}
      </div>

      {/* ── CATEGORY FILTERS ── */}
      <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>CATEGORY:</span>
        {(['all', ...POWER_CATS] as string[]).map(cat => (
          <div
            key={cat}
            onClick={() => setCatFilter(cat)}
            style={{
              fontSize: 7, letterSpacing: '0.07em', padding: '2px 6px',
              border: `1px solid ${catFilter === cat ? 'var(--accent2)' : 'var(--border)'}`,
              color: catFilter === cat ? 'var(--accent2)' : 'var(--muted)',
              cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif",
              background: catFilter === cat ? 'rgba(255,184,0,0.07)' : 'transparent',
              transition: 'all 0.1s',
            }}
          >
            {cat.toUpperCase()}
          </div>
        ))}
      </div>

      {/* ── POWER GRID ── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 9,
      }}>
        {shopPowers.map(power => {
          const isForged  = forged.some(f => f.powerId === power.id)
          const rc        = rarColor(power.rarity)
          const isDia     = power.rarity === 'legendary'
          const price     = isDia ? 12 : ({ common: 50, rare: 120, epic: 220, legendary: 12, mythical: 0 } as Record<string, number>)[power.rarity] ?? 0
          const canAfford = isDia ? diamonds >= price : coins >= price

          return (
            <div
              key={power.id}
              style={{
                background: 'var(--panel)',
                border: `1px solid ${isForged ? 'rgba(60,255,180,0.3)' : 'var(--border)'}`,
                padding: 11, display: 'flex', flexDirection: 'column', gap: 4,
                opacity: isForged ? 0.55 : 1,
                transition: 'border-color 0.12s',
              }}
            >
              {/* Rarity + category */}
              <div style={{ fontSize: 7, color: rc, letterSpacing: '0.13em' }}>
                {rarLabel(power.rarity)} · {power.cat.toUpperCase()}
              </div>

              {/* Name */}
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 15,
                color: 'var(--accent2)',
              }}>
                {power.icon} {power.name}
              </div>

              {/* Desc */}
              <div style={{ fontSize: 7, color: 'var(--muted)', lineHeight: 1.4, flex: 1 }}>
                {power.desc}
              </div>

              {/* Stats */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', fontSize: 7, color: 'var(--muted)' }}>
                {power.damage && <span>💥 {power.damage} dmg</span>}
                {power.heal   && <span>💚 {power.heal} heal</span>}
                {power.range > 0 && <span>📏 range {power.range}</span>}
              </div>

              {/* Price + button */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 4 }}>
                <span style={{
                  fontSize: 10, fontFamily: "'Bebas Neue', sans-serif",
                  color: isDia ? 'var(--purple)' : 'var(--accent2)',
                }}>
                  {isDia ? '💎' : '🪙'} {price}
                </span>

                {isForged ? (
                  <div style={{ fontSize: 8, color: 'var(--accent3)' }}>✓ FORGED</div>
                ) : (
                  <button
                    className={`btn ${isDia ? 'btn-purple' : 'btn-confirm'}`}
                    style={{ fontSize: 10, padding: '3px 10px' }}
                    disabled={!canAfford}
                    onClick={() => handleBuy(power)}
                    title={!canAfford ? `Need ${isDia ? '💎' : '🪙'} ${price}` : ''}
                  >
                    {canAfford ? 'BUY & FORGE' : `NEED ${isDia ? '💎' : '🪙'}${price}`}
                  </button>
                )}
              </div>

              {/* Can't afford hint */}
              {!isForged && !canAfford && (
                <div style={{ fontSize: 7, color: 'var(--accent)', marginTop: 2 }}>
                  {isDia
                    ? `Need ${price - diamonds} more 💎 diamonds`
                    : `Need ${price - coins} more 🪙 coins`}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── MYTHICAL SECTION ── */}
      <div style={{
        borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4,
      }}>
        <div style={{ fontSize: 10, color: 'var(--r-mythical)', letterSpacing: '0.2em', marginBottom: 10 }}>
          ☠ MYTHICAL POWERS — EVENT ONLY — NOT FOR SALE
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
          gap: 9,
        }}>
          {ALL_POWERS.filter(p => p.rarity === 'mythical').map(power => (
            <div
              key={power.id}
              style={{
                background: 'var(--panel)',
                border: '1px solid rgba(255,60,60,0.28)',
                padding: 11, display: 'flex', flexDirection: 'column', gap: 4,
                boxShadow: '0 0 10px rgba(255,60,60,0.06)',
              }}
            >
              <div style={{ fontSize: 7, color: 'var(--r-mythical)', letterSpacing: '0.13em' }}>
                MYTHICAL · {power.cat.toUpperCase()}
              </div>
              <div style={{
                fontFamily: "'Bebas Neue', sans-serif", fontSize: 15,
                color: 'var(--r-mythical)',
              }}>
                {power.icon} {power.name}
              </div>
              <div style={{ fontSize: 7, color: 'var(--muted)', lineHeight: 1.4 }}>
                {power.desc}
              </div>
              <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 4 }}>
                🔒 Earned through limited events only
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom padding */}
      <div style={{ height: 20 }} />

    </div>
  )
}