import React, { useState } from 'react'
import { useStore } from '@store'
import { PACK_DEFS, openPack, type PackId } from '@data/packs'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, rarLabel, SYN_TAGS } from '@data/rarity'
import { save } from '@systems/SaveManager'
import type { Curse, ForgedEntry } from '@data/types'

// ============================================================
// PACK SHOP SCREEN
// Buy packs, get random cards, bind curses on new cards.
// ============================================================

type ShopPhase = 'shop' | 'opening' | 'curse_pick' | 'results'

interface PulledCard {
  powerId:   string
  rarity:    string
  isNew:     boolean
  curseId?:  string
  revealed:  boolean
}

export default function PackShopScreen() {
  const { setScreen, coins, diamonds, forged, addForged, updateForged } = useStore()

  const [phase,       setPhase]       = useState<ShopPhase>('shop')
  const [cards,       setCards]       = useState<PulledCard[]>([])
  const [curseIdx,    setCurseIdx]    = useState(0)      // which new card we're picking curse for
  const [curseOpts,   setCurseOpts]   = useState<Curse[]>([])
  const [chosenCurse, setChosenCurse] = useState<Curse | null>(null)
  const [pendingNew,  setPendingNew]  = useState<PulledCard[]>([])
  const [error,       setError]       = useState<string | null>(null)

  function canAfford(pack: typeof PACK_DEFS[0]) {
    return pack.currency === 'coins' ? coins >= pack.cost : diamonds >= pack.cost
  }

  function handleBuyPack(packId: PackId) {
    const pack = PACK_DEFS.find(p => p.id === packId)!
    setError(null)

    if (!canAfford(pack)) { setError(`Not enough ${pack.currency === 'coins' ? '🪙 coins' : '💎 diamonds'}!`); return }

    // Deduct cost
    if (pack.currency === 'coins') {
      save.coins -= pack.cost; save.persistCoins()
      useStore.setState({ coins: save.coins })
    } else {
      save.diamonds -= pack.cost; save.persistCoins()
      useStore.setState({ diamonds: save.diamonds })
    }

    // Pull cards
    const pulled = openPack(packId).map(c => ({
      ...c,
      isNew:    !forged.some(f => f.powerId === c.powerId),
      revealed: false,
    }))

    setCards(pulled)
    setPhase('opening')

    // Reveal cards one by one with delay
    pulled.forEach((_, i) => {
      setTimeout(() => {
        setCards(prev => prev.map((c, idx) => idx === i ? { ...c, revealed: true } : c))
      }, (i + 1) * 900)
    })

    // After all revealed — check for new cards needing curse selection
    setTimeout(() => {
      const newCards = pulled.filter(c => c.isNew)
      if (newCards.length > 0) {
        setPendingNew(newCards)
        pickCurseForCard(newCards, 0, pulled)
      } else {
        // All duplicates — add them directly
        addDuplicates(pulled, pulled)
        setPhase('results')
      }
    }, (pulled.length + 1) * 900 + 400)
  }

  function pickCurseForCard(newCards: PulledCard[], idx: number, allCards: PulledCard[]) {
    if (idx >= newCards.length) {
      addDuplicates(allCards, allCards)
      setPhase('results')
      return
    }
    setCurseIdx(idx)
    setChosenCurse(null)

    // Generate 3 random curses
    const shuffled = [...ALL_CURSES].sort(() => Math.random() - 0.5)
    setCurseOpts(shuffled.slice(0, 3))
    setPhase('curse_pick')
  }

  function handleConfirmCurse() {
    if (!chosenCurse) return
    const updated = cards.map((c, i) => {
      if (c.powerId === pendingNew[curseIdx].powerId && c.isNew) return { ...c, curseId: chosenCurse.id }
      return c
    })
    setCards(updated)

    const nextIdx = curseIdx + 1
    if (nextIdx < pendingNew.length) {
      pickCurseForCard(pendingNew, nextIdx, updated)
    } else {
      addDuplicates(updated, updated)
      setPhase('results')
    }
  }

  function addDuplicates(allCards: PulledCard[], updatedCards: PulledCard[]) {
    const newForged = [...forged]

    updatedCards.forEach(card => {
      const existingIdx = newForged.findIndex(f => f.powerId === card.powerId)
      if (existingIdx >= 0) {
        // Add duplicate
        newForged[existingIdx] = {
          ...newForged[existingIdx],
          duplicates: (newForged[existingIdx].duplicates ?? 0) + 1,
        }
      } else if (card.isNew && card.curseId) {
        // New card
        newForged.push({
          powerId:     card.powerId,
          curseId:     card.curseId,
          rerollCount: 0,
          refinements: [],
          level:       1,
          duplicates:  0,
        })
      }
    })

    save.forged = newForged
    save.persistForged()
    updateForged(newForged)
  }

  // ── SHOP VIEW ─────────────────────────────────────────────
  if (phase === 'shop') return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: 'var(--bg)', overflowY: 'auto', padding: '16px 20px', gap: 14, pointerEvents: 'all' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border)', paddingBottom: 12 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent2)' }}>📦 CARD PACKS</div>
        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <div style={{ fontSize: 13, color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif" }}>🪙 {coins} · 💎 {diamonds}</div>
          <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
        </div>
      </div>

      <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.6 }}>
        Open packs to get random power cards. New cards require you to choose a curse. Duplicate cards increase your upgrade count — upgrade cards to boost their stats up to <strong style={{ color: 'var(--accent2)' }}>+45% at max level</strong>.
      </div>

      {error && <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid var(--accent)', padding: '10px 14px', fontSize: 10, color: 'var(--accent)' }}>⚠ {error}</div>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: 12 }}>
        {PACK_DEFS.map(pack => {
          const afford  = canAfford(pack)
          const rc      = pack.color
          const isDia   = pack.currency === 'diamonds'
          return (
            <div key={pack.id} style={{ background: 'var(--panel)', border: `2px solid ${rc}`, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10, boxShadow: `0 0 12px ${rc}22` }}>
              <div style={{ fontSize: 36, textAlign: 'center' }}>{pack.icon}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: rc, textAlign: 'center' }}>{pack.name}</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', lineHeight: 1.5 }}>{pack.desc}</div>

              {/* Rarity chances */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                {Object.entries(pack.weights).filter(([, w]) => w > 0).map(([rarity, weight]) => (
                  <div key={rarity} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 8 }}>
                    <span style={{ color: rarColor(rarity as any) }}>{rarLabel(rarity as any)}</span>
                    <span style={{ color: 'var(--muted)' }}>{weight}%</span>
                  </div>
                ))}
              </div>

              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: isDia ? 'var(--purple)' : 'var(--accent2)' }}>
                  {isDia ? '💎' : '🪙'} {pack.cost}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2 }}>
                  <div style={{ fontSize: 8, color: 'var(--muted)' }}>{pack.cards} cards</div>
                  <button
                    className={`btn ${isDia ? 'btn-purple' : 'btn-gold'}`}
                    style={{ fontSize: 11, padding: '4px 12px' }}
                    disabled={!afford}
                    onClick={() => handleBuyPack(pack.id)}
                  >
                    {afford ? 'OPEN' : 'NEED MORE'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* Mythical note */}
      <div style={{ background: 'rgba(255,60,60,0.04)', border: '1px solid rgba(255,60,60,0.2)', padding: '10px 14px', fontSize: 9, color: 'var(--muted)', lineHeight: 1.6, textAlign: 'center' }}>
        ☠ <strong style={{ color: 'var(--r-mythical)' }}>MYTHICAL CARDS</strong> cannot be obtained from packs. They are earned exclusively through limited-time Events.
      </div>

      <div style={{ height: 20 }} />
    </div>
  )

  // ── OPENING VIEW ──────────────────────────────────────────
  if (phase === 'opening') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', gap: 24, padding: 24, pointerEvents: 'all' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent2)', letterSpacing: '0.1em' }}>OPENING PACK...</div>
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cards.map((card, i) => {
          const power = ALL_POWERS.find(p => p.id === card.powerId)
          const rc    = rarColor(card.rarity as any)
          return (
            <div key={i} style={{
              width: 140, height: 190,
              background: card.revealed ? 'var(--panel)' : 'var(--panel2)',
              border: `2px solid ${card.revealed ? rc : 'var(--border)'}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              gap: 8, padding: 12, textAlign: 'center',
              transition: 'all 0.4s',
              boxShadow: card.revealed ? `0 0 20px ${rc}44` : 'none',
              transform: card.revealed ? 'scale(1.04)' : 'scale(1)',
            }}>
              {card.revealed && power ? (
                <>
                  <div style={{ fontSize: 32 }}>{power.icon}</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: rc }}>{power.name}</div>
                  <div style={{ fontSize: 7, color: rarColor(card.rarity as any), letterSpacing: '0.1em' }}>{rarLabel(card.rarity as any)}</div>
                  {!card.isNew && <div style={{ fontSize: 8, color: 'var(--accent3)', border: '1px solid var(--accent3)', padding: '2px 6px' }}>+1 DUPE</div>}
                  {card.isNew  && <div style={{ fontSize: 8, color: 'var(--accent2)', border: '1px solid var(--accent2)', padding: '2px 6px' }}>NEW!</div>}
                </>
              ) : (
                <div style={{ fontSize: 40 }}>❓</div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )

  // ── CURSE PICK VIEW ───────────────────────────────────────
  if (phase === 'curse_pick') {
    const card  = pendingNew[curseIdx]
    const power = ALL_POWERS.find(p => p.id === card?.powerId)
    const rc    = power ? rarColor(power.rarity) : 'var(--accent2)'

    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'rgba(0,0,0,0.95)', gap: 16, padding: 24, pointerEvents: 'all', overflowY: 'auto' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 30, color: 'var(--accent2)', textAlign: 'center' }}>
          ⚒ BIND A CURSE
        </div>
        <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em', textAlign: 'center' }}>
          NEW CARD {curseIdx + 1} OF {pendingNew.length} — CHOOSE A PERMANENT CURSE
        </div>

        {/* Power card */}
        {power && (
          <div style={{ background: 'var(--panel)', border: `2px solid ${rc}`, padding: '14px 20px', maxWidth: 300, width: '100%', textAlign: 'center' }}>
            <div style={{ fontSize: 8, color: rc, letterSpacing: '0.14em', fontFamily: "'Bebas Neue', sans-serif" }}>{rarLabel(power.rarity)} · {power.cat.toUpperCase()}</div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: 'var(--accent2)', marginTop: 4 }}>{power.icon} {power.name}</div>
            <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 6, lineHeight: 1.5 }}>{power.desc}</div>
            {power.damage && <div style={{ fontSize: 10, color: '#ff8080', marginTop: 4 }}>💥 {power.damage} dmg · range {power.range}</div>}
            {power.heal   && <div style={{ fontSize: 10, color: 'var(--accent3)', marginTop: 4 }}>💚 {power.heal} heal · range {power.range}</div>}
          </div>
        )}

        {/* Curse options */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, maxWidth: 720, width: '100%' }}>
          {curseOpts.map(curse => {
            const chosen = chosenCurse?.id === curse.id
            return (
              <div key={curse.id} onClick={() => setChosenCurse(curse)} style={{ background: chosen ? 'rgba(60,255,180,0.06)' : 'var(--panel)', border: `2px solid ${chosen ? 'var(--accent3)' : 'var(--border)'}`, padding: 14, cursor: 'pointer', transition: 'all 0.12s' }}>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent)' }}>{curse.icon} {curse.name}</div>
                <div style={{ fontSize: 10, color: '#ff8080', lineHeight: 1.55, marginTop: 4 }}>{curse.desc}</div>
                <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 6 }}>
                  {curse.synergy.map(k => <span key={k} className={`syn-tag ${SYN_TAGS[k]?.cls ?? ''}`} style={{ fontSize: 7 }}>{SYN_TAGS[k]?.label ?? k}</span>)}
                </div>
                {chosen && <div style={{ fontSize: 8, color: 'var(--accent3)', marginTop: 6 }}>✓ SELECTED</div>}
              </div>
            )
          })}
        </div>

        <button className="btn btn-confirm" style={{ fontSize: 16, padding: '10px 28px' }} disabled={!chosenCurse} onClick={handleConfirmCurse}>
          ⚒ BIND CURSE
        </button>
      </div>
    )
  }

  // ── RESULTS VIEW ──────────────────────────────────────────
  if (phase === 'results') return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg)', gap: 20, padding: 24, pointerEvents: 'all' }}>
      <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 32, color: 'var(--accent2)' }}>PACK OPENED!</div>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
        {cards.map((card, i) => {
          const power = ALL_POWERS.find(p => p.id === card.powerId)
          const rc    = rarColor(card.rarity as any)
          return (
            <div key={i} style={{ background: 'var(--panel)', border: `2px solid ${rc}`, padding: '14px 16px', width: 140, textAlign: 'center', boxShadow: card.isNew ? `0 0 16px ${rc}44` : 'none' }}>
              <div style={{ fontSize: 28 }}>{power?.icon}</div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: rc, marginTop: 4 }}>{power?.name}</div>
              <div style={{ fontSize: 7, color: rarColor(card.rarity as any), letterSpacing: '0.1em', marginTop: 2 }}>{rarLabel(card.rarity as any)}</div>
              <div style={{ fontSize: 8, marginTop: 6, color: card.isNew ? 'var(--accent2)' : 'var(--accent3)' }}>
                {card.isNew ? '✨ NEW CARD' : '+1 UPGRADE'}
              </div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button className="btn btn-primary" onClick={() => setPhase('shop')}>OPEN ANOTHER</button>
        <button className="btn btn-secondary" onClick={() => setScreen('collection')}>VIEW COLLECTION</button>
        <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
      </div>
    </div>
  )

  return null
}