import React, { useState } from 'react'
import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, rarLabel, POWER_CATS, SYN_TAGS } from '@data/rarity'
import { buyPower, confirmForge, generateCurseOptions } from '@systems/ForgeSystem'
import { save } from '@systems/SaveManager'
import type { Power, Curse } from '@data/types'

type RarFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary'

const COSTS: Record<string, number> = { common: 50, rare: 120, epic: 220, legendary: 12, mythical: 0 }

export default function ShopScreen(): React.ReactElement {
  const { setScreen, forged, addForged, coins, diamonds } = useStore()

  const [rarFilter, setRarFilter] = useState<RarFilter>('all')
  const [catFilter, setCatFilter] = useState<string>('all')
  const [notification, setNotification] = useState<string | null>(null)

  // Forge overlay state
  const [forgingPower, setForgingPower]  = useState<Power | null>(null)
  const [curseOptions, setCurseOptions]  = useState<Curse[]>([])
  const [chosenCurse,  setChosenCurse]   = useState<Curse | null>(null)

  // Detail panel — hover/click to expand
  const [detailPower, setDetailPower] = useState<Power | null>(null)

  function notify(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 2400)
  }

  const shopPowers = ALL_POWERS.filter(p => {
    if (p.rarity === 'mythical') return false
    if (rarFilter !== 'all' && p.rarity !== rarFilter) return false
    if (catFilter !== 'all' && p.cat !== catFilter) return false
    return true
  })

  function handleBuy(power: Power) {
    const result = buyPower(power)
    if ('error' in result) { notify(result.error); return }
    useStore.setState({ coins: save.coins, diamonds: save.diamonds })
    setForgingPower(power)
    setCurseOptions(result.cursePool)
    setChosenCurse(null)
  }

  function handleConfirmForge() {
    if (!forgingPower || !chosenCurse) return
    confirmForge(forgingPower.id, chosenCurse.id)
    addForged({ powerId: forgingPower.id, curseId: chosenCurse.id, rerollCount: 0, refinements: [] })
    notify(`⚒ Forged: ${forgingPower.name} + ${chosenCurse.name}!`)
    setForgingPower(null); setChosenCurse(null)
  }

  function handleCancelForge() {
    if (forgingPower) {
      const isDia = forgingPower.rarity === 'legendary'
      if (isDia) save.diamonds += 12; else save.coins += COSTS[forgingPower.rarity] ?? 0
      save.persistCoins()
      useStore.setState({ coins: save.coins, diamonds: save.diamonds })
    }
    setForgingPower(null); setChosenCurse(null)
  }

  // ── Stat line for a power ─────────────────────────────────
  function PowerStats({ p }: { p: Power }) {
    return (
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>
        {p.damage && <span style={{ color: '#ff8080' }}>💥 {p.damage} dmg</span>}
        {p.heal   && <span style={{ color: 'var(--accent3)' }}>💚 {p.heal} heal</span>}
        {p.range  > 0 && <span>📏 range {p.range}</span>}
        <span style={{ color: rarColor(p.rarity), textTransform: 'uppercase', fontSize: 7 }}>{p.cat}</span>
      </div>
    )
  }

  return (
    <div style={{
      display: 'flex', flexDirection: 'column',
      height: '100vh', overflowY: 'auto',
      padding: '14px 18px', gap: 12,
      maxWidth: 1200, margin: '0 auto', width: '100%',
      background: 'var(--bg)', pointerEvents: 'all',
    }}>

      {/* Toast */}
      {notification && (
        <div style={{ position: 'fixed', top: 16, left: '50%', transform: 'translateX(-50%)', background: 'var(--panel)', border: '1px solid var(--accent3)', color: 'var(--accent3)', padding: '8px 20px', fontSize: 11, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.1em', zIndex: 1000, whiteSpace: 'nowrap' }}>
          {notification}
        </div>
      )}

      {/* ── FORGE OVERLAY ── */}
      {forgingPower && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 28, zIndex: 900, overflowY: 'auto', pointerEvents: 'all' }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: 'var(--accent2)' }}>⚒ FORGE YOUR POWER</h2>
            <p style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.15em', marginTop: 3 }}>CHOOSE A CURSE TO PERMANENTLY BIND — THIS CANNOT BE UNDONE (BUT CAN BE REROLLED)</p>
          </div>

          {/* Power card */}
          <div style={{ background: 'var(--panel)', border: `2px solid ${rarColor(forgingPower.rarity)}`, padding: '14px 20px', maxWidth: 340, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: rarColor(forgingPower.rarity), letterSpacing: '0.16em' }}>{rarLabel(forgingPower.rarity)} · {forgingPower.cat.toUpperCase()}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: rarColor(forgingPower.rarity), marginTop: 2 }}>{forgingPower.icon} {forgingPower.name}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 5, lineHeight: 1.5 }}>{forgingPower.desc}</div>
            {forgingPower.damage && <div style={{ fontSize: 10, color: '#ff8080', marginTop: 4 }}>💥 {forgingPower.damage} damage · range {forgingPower.range}</div>}
            {forgingPower.heal   && <div style={{ fontSize: 10, color: 'var(--accent3)', marginTop: 4 }}>💚 {forgingPower.heal} heal · range {forgingPower.range}</div>}
          </div>

          {/* Curse grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12, maxWidth: 820, width: '100%' }}>
            {curseOptions.map(curse => {
              const isChosen = chosenCurse?.id === curse.id
              return (
                <div key={curse.id} onClick={() => setChosenCurse(curse)} style={{ background: isChosen ? 'rgba(60,255,180,0.06)' : 'var(--panel)', border: `2px solid ${isChosen ? 'var(--accent3)' : 'var(--border)'}`, padding: 16, cursor: 'pointer', transition: 'all 0.13s', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ fontSize: 7, color: rarColor(curse.rarity), letterSpacing: '0.12em' }}>{rarLabel(curse.rarity)} · {curse.cat.toUpperCase()}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--accent)' }}>{curse.icon} {curse.name}</div>
                  <div style={{ fontSize: 10, color: '#ff8080', lineHeight: 1.55 }}>{curse.desc}</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                    {curse.synergy.map(k => (
                      <span key={k} className={`syn-tag ${SYN_TAGS[k]?.cls ?? ''}`}>{SYN_TAGS[k]?.label ?? k}</span>
                    ))}
                  </div>
                  {isChosen && <div style={{ fontSize: 8, color: 'var(--accent3)', marginTop: 4, letterSpacing: '0.1em' }}>✓ SELECTED</div>}
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: 11, color: 'var(--accent3)', minHeight: 20, textAlign: 'center' }}>
            {chosenCurse ? `RESULT: ${forgingPower.icon} ${forgingPower.name} + ${chosenCurse.icon} ${chosenCurse.name}` : '— select a curse above —'}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-confirm" disabled={!chosenCurse} onClick={handleConfirmForge}>⚒ FORGE IT</button>
            <button className="btn btn-secondary" onClick={handleCancelForge}>CANCEL (REFUND)</button>
          </div>
        </div>
      )}

      {/* ── TOP BAR ── */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid var(--border)', paddingBottom: 10, flexWrap: 'wrap', gap: 7 }}>
        <h2 style={{ fontSize: 24, color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif" }}>🛒 POWER SHOP</h2>
        <div style={{ display: 'flex', gap: 7, alignItems: 'center' }}>
          <div className="cur-bar" style={{ padding: '4px 9px' }}>
            <div className="cur-item"><span className="cur-icon">🪙</span><span className="cur-val">{coins}</span><span className="cur-label">COINS</span></div>
            <div className="cur-item"><span className="cur-icon">💎</span><span className="cur-val">{diamonds}</span><span className="cur-label">DIAMONDS</span></div>
          </div>
          <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
        </div>
      </div>

      <div style={{ fontSize: 9, color: 'var(--muted)' }}>
        Buy a power → choose its bound curse → added to Collection. Curses can be rerolled in Collection. Click any card to see full details.
      </div>

      {/* AD SLOT */}
      <div id="ad-slot-shop-banner" style={{ height: 60, background: 'rgba(255,255,255,0.02)', border: '1px dashed rgba(255,255,255,0.06)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 8, color: 'rgba(255,255,255,0.1)', letterSpacing: '0.2em' }}>AD SLOT</div>

      {/* ── FILTERS ── */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>RARITY:</span>
          {(['all','common','rare','epic','legendary'] as RarFilter[]).map(r => (
            <div key={r} onClick={() => setRarFilter(r)} style={{ fontSize: 8, letterSpacing: '0.08em', padding: '2px 9px', border: `1px solid ${rarFilter===r ? (r==='all'?'var(--accent2)':rarColor(r as any)) : 'var(--border)'}`, color: rarFilter===r ? (r==='all'?'var(--accent2)':rarColor(r as any)) : 'var(--muted)', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", transition: 'all 0.1s' }}>
              {r.toUpperCase()}
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontSize: 8, color: 'var(--muted)', letterSpacing: '0.12em' }}>TYPE:</span>
          {(['all',...POWER_CATS] as string[]).map(cat => (
            <div key={cat} onClick={() => setCatFilter(cat)} style={{ fontSize: 7, letterSpacing: '0.07em', padding: '2px 6px', border: `1px solid ${catFilter===cat?'var(--accent2)':'var(--border)'}`, color: catFilter===cat?'var(--accent2)':'var(--muted)', cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif", background: catFilter===cat?'rgba(255,184,0,0.07)':'transparent', transition: 'all 0.1s' }}>
              {cat.toUpperCase()}
            </div>
          ))}
        </div>
      </div>

      {/* ── MAIN LAYOUT: grid + detail panel ── */}
      <div style={{ display: 'grid', gridTemplateColumns: detailPower ? '1fr 340px' : '1fr', gap: 14, alignItems: 'start' }}>

        {/* ── POWER GRID ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {shopPowers.map(power => {
            const isOwned   = forged.some(f => f.powerId === power.id)
            const rc        = rarColor(power.rarity)
            const isDia     = power.rarity === 'legendary'
            const price     = COSTS[power.rarity] ?? 0
            const canAfford = isDia ? diamonds >= price : coins >= price
            const isDetail  = detailPower?.id === power.id

            return (
              <div
                key={power.id}
                onClick={() => setDetailPower(isDetail ? null : power)}
                style={{
                  background: isDetail ? 'rgba(255,184,0,0.05)' : 'var(--panel)',
                  border: `2px solid ${isDetail ? 'var(--accent2)' : isOwned ? 'rgba(60,255,180,0.3)' : rc}`,
                  padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 5,
                  opacity: isOwned ? 0.6 : 1, cursor: 'pointer', transition: 'all 0.12s',
                }}
              >
                {/* Rarity label */}
                <div style={{ fontSize: 7, color: rc, letterSpacing: '0.14em', fontFamily: "'Bebas Neue', sans-serif" }}>
                  {rarLabel(power.rarity)}
                </div>

                {/* Name */}
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent2)', lineHeight: 1 }}>
                  {power.icon} {power.name}
                </div>

                {/* Description */}
                <div style={{ fontSize: 10, color: 'var(--text)', lineHeight: 1.5, flex: 1 }}>
                  {power.desc}
                </div>

                {/* Stats */}
                <PowerStats p={power} />

                {/* Price + action */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 6, paddingTop: 6, borderTop: '1px solid var(--border)' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: isDia ? 'var(--purple)' : 'var(--accent2)' }}>
                    {isDia ? '💎' : '🪙'} {price}
                  </span>
                  {isOwned ? (
                    <span style={{ fontSize: 9, color: 'var(--accent3)' }}>✓ OWNED</span>
                  ) : (
                    <button
                      className={`btn ${isDia ? 'btn-purple' : 'btn-confirm'}`}
                      style={{ fontSize: 10, padding: '3px 10px' }}
                      disabled={!canAfford}
                      onClick={e => { e.stopPropagation(); handleBuy(power) }}
                    >
                      {canAfford ? 'BUY & FORGE' : `NEED ${isDia ? '💎' : '🪙'}${price - (isDia ? diamonds : coins)} MORE`}
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>

        {/* ── DETAIL PANEL ── */}
        {detailPower && (
          <div style={{ background: 'var(--panel)', border: `2px solid ${rarColor(detailPower.rarity)}`, padding: 18, position: 'sticky', top: 10 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
              <div>
                <div style={{ fontSize: 8, color: rarColor(detailPower.rarity), letterSpacing: '0.16em', fontFamily: "'Bebas Neue', sans-serif" }}>{rarLabel(detailPower.rarity)} · {detailPower.cat.toUpperCase()}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: 'var(--accent2)', lineHeight: 1, marginTop: 3 }}>{detailPower.icon} {detailPower.name}</div>
              </div>
              <span style={{ cursor: 'pointer', color: 'var(--muted)', fontSize: 14 }} onClick={() => setDetailPower(null)}>✕</span>
            </div>

            <div style={{ fontSize: 11, color: 'var(--text)', lineHeight: 1.65, marginBottom: 10 }}>{detailPower.desc}</div>

            {/* Stats block */}
            <div style={{ background: 'var(--panel2)', padding: '8px 12px', marginBottom: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 2 }}>STATS</div>
              {detailPower.damage && <div style={{ fontSize: 11, color: '#ff8080' }}>💥 Damage: <strong>{detailPower.damage}</strong></div>}
              {detailPower.heal   && <div style={{ fontSize: 11, color: 'var(--accent3)' }}>💚 Heal: <strong>{detailPower.heal}</strong></div>}
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>📏 Range: <span style={{ color: 'var(--text)' }}>{detailPower.range}</span></div>
              <div style={{ fontSize: 11, color: 'var(--muted)' }}>🎯 Type: <span style={{ color: 'var(--text)', textTransform: 'capitalize' }}>{detailPower.type}</span></div>
            </div>

            {/* What curse will do */}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, marginBottom: 10 }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 12, color: 'var(--accent)', letterSpacing: '0.1em', marginBottom: 6 }}>⚠ BOUND CURSE (chosen at forge)</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.55 }}>
                When you buy this power you will choose <strong style={{ color: 'var(--text)' }}>1 of 3 curses</strong> to permanently bind to it. The curse creates a permanent downside on that card.
                <br /><br />
                Curses can be <strong style={{ color: 'var(--purple)' }}>rerolled in Collection</strong> for 💎 Diamonds. Max 2 refinements can be added later for 🪙 Coins.
              </div>
            </div>

            {/* Action */}
            {!forged.some(f => f.powerId === detailPower.id) ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button
                  className={`btn ${detailPower.rarity === 'legendary' ? 'btn-purple' : 'btn-confirm'}`}
                  disabled={detailPower.rarity === 'legendary' ? diamonds < 12 : coins < (COSTS[detailPower.rarity] ?? 0)}
                  onClick={() => handleBuy(detailPower)}
                >
                  BUY & FORGE · {detailPower.rarity === 'legendary' ? '💎 12' : `🪙 ${COSTS[detailPower.rarity]}`}
                </button>
              </div>
            ) : (
              <div style={{ fontSize: 10, color: 'var(--accent3)' }}>✓ Already in your collection</div>
            )}
          </div>
        )}
      </div>

      {/* ── MYTHICAL SECTION ── */}
      <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, marginTop: 4 }}>
        <div style={{ fontSize: 10, color: 'var(--r-mythical)', letterSpacing: '0.2em', marginBottom: 10, fontFamily: "'Bebas Neue', sans-serif" }}>☠ MYTHICAL POWERS — EVENT ONLY — NOT FOR SALE</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
          {ALL_POWERS.filter(p => p.rarity === 'mythical').map(power => (
            <div key={power.id} style={{ background: 'var(--panel)', border: '1px solid rgba(255,60,60,0.28)', padding: '12px 14px', boxShadow: '0 0 10px rgba(255,60,60,0.06)' }}>
              <div style={{ fontSize: 7, color: 'var(--r-mythical)', letterSpacing: '0.13em', fontFamily: "'Bebas Neue', sans-serif" }}>MYTHICAL · {power.cat.toUpperCase()}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--r-mythical)', marginTop: 2 }}>{power.icon} {power.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.5, marginTop: 5 }}>{power.desc}</div>
              <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 6 }}>🔒 Earned through limited events only</div>
            </div>
          ))}
        </div>
      </div>

      <div style={{ height: 24 }} />
    </div>
  )
}