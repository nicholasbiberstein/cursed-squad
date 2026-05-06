import React, { useState } from 'react'
import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, rarLabel, SYN_TAGS, POWER_CATS } from '@data/rarity'
import { getRefineOptions } from '@data/refinements'
import { rerollCost, refineCost, confirmReroll, applyRefinement, generateCurseOptions } from '@systems/ForgeSystem'
import { save } from '@systems/SaveManager'
import type { ForgedEntry, Curse, Power } from '@data/types'

type RarFilter = 'all' | 'common' | 'rare' | 'epic' | 'legendary' | 'mythical'

export default function CollectionScreen(): React.ReactElement {
  const { setScreen, forged, updateForged, coins, diamonds } = useStore()

  const [rarFilter, setRarFilter]   = useState<RarFilter>('all')
  const [catFilter, setCatFilter]   = useState<string>('all')
  const [notification, setNotification] = useState<string | null>(null)

  // Reroll flow
  const [rerollingEntry,  setRerollingEntry]  = useState<ForgedEntry | null>(null)
  const [rerollingPower,  setRerollingPower]  = useState<Power | null>(null)
  const [rerollOptions,   setRerollOptions]   = useState<Curse[]>([])
  const [chosenReroll,    setChosenReroll]    = useState<Curse | null>(null)

  // Refine flow
  const [refiningEntry,   setRefiningEntry]   = useState<ForgedEntry | null>(null)
  const [refiningPower,   setRefiningPower]   = useState<Power | null>(null)
  const [chosenRefine,    setChosenRefine]    = useState<string | null>(null)

  function notify(msg: string) {
    setNotification(msg)
    setTimeout(() => setNotification(null), 2400)
  }

  // Filtered collection
  const visible = forged.filter(f => {
    const p = ALL_POWERS.find(x => x.id === f.powerId)
    if (!p) return false
    if (rarFilter !== 'all' && p.rarity !== rarFilter) return false
    if (catFilter !== 'all' && p.cat !== catFilter) return false
    return true
  })

  // ── REROLL ──────────────────────────────────────────────────
  function openReroll(entry: ForgedEntry, power: Power) {
    const cost = rerollCost(entry, power)
    if (save.diamonds < cost) { notify(`Need 💎 ${cost} diamonds to reroll.`); return }
    const options = generateCurseOptions(power)
    setRerollingEntry(entry)
    setRerollingPower(power)
    setRerollOptions(options)
    setChosenReroll(null)
  }

  function handleConfirmReroll() {
    if (!rerollingEntry || !rerollingPower || !chosenReroll) return
    const cost = rerollCost(rerollingEntry, rerollingPower)
    save.diamonds -= cost
    save.persistCoins()
    confirmReroll(rerollingEntry, chosenReroll.id)
    updateForged([...save.forged])
    useStore.setState({ diamonds: save.diamonds })
    notify(`♻ Rerolled to: ${chosenReroll.icon} ${chosenReroll.name}`)
    setRerollingEntry(null)
    setRerollingPower(null)
    setChosenReroll(null)
  }

  function cancelReroll() {
    setRerollingEntry(null)
    setRerollingPower(null)
    setChosenReroll(null)
  }

  // ── REFINE ──────────────────────────────────────────────────
  function openRefine(entry: ForgedEntry, power: Power) {
    const refs = entry.refinements ?? []
    if (refs.length >= 2) { notify('Max 2 refinements per card.'); return }
    const cost = refineCost(power)
    if (save.coins < cost) { notify(`Need 🪙 ${cost} coins to refine.`); return }
    setRefiningEntry(entry)
    setRefiningPower(power)
    setChosenRefine(null)
  }

  function handleConfirmRefine() {
    if (!refiningEntry || !refiningPower || !chosenRefine) return
    const result = applyRefinement(refiningPower, refiningEntry, chosenRefine)
    if ('error' in result) { notify(result.error); return }
    updateForged([...save.forged])
    useStore.setState({ coins: save.coins })
    const ref = getRefineOptions(refiningPower).find(r => r.id === chosenRefine)
    notify(`⚙ Refined: ${ref?.name ?? chosenRefine}`)
    setRefiningEntry(null)
    setRefiningPower(null)
    setChosenRefine(null)
  }

  function cancelRefine() {
    setRefiningEntry(null)
    setRefiningPower(null)
    setChosenRefine(null)
  }

  const SYN_COLORS: Record<string, string> = {
    'high-risk': '#f43', 'positioning': 'var(--blue)', 'unstable': '#f8f',
    'defensive': 'var(--accent3)', 'aggressive': 'var(--accent2)',
    'utility': 'var(--purple)', 'stealth': '#888',
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

      {/* ── REROLL OVERLAY ── */}
      {rerollingEntry && rerollingPower && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 18, padding: 28, zIndex: 900,
          overflowY: 'auto', pointerEvents: 'all',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: 'var(--purple)' }}>
              ♻ REROLL CURSE
            </h2>
            <p style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.18em', marginTop: 3 }}>
              CHOOSE A NEW CURSE TO BIND · COSTS 💎 {rerollCost(rerollingEntry, rerollingPower)}
              {rerollingEntry.rerollCount > 0 && ` (×${rerollingEntry.rerollCount + 1})`}
            </p>
          </div>

          {/* Power display */}
          <div style={{
            background: 'var(--panel)',
            border: `2px solid ${rarColor(rerollingPower.rarity)}`,
            padding: '11px 18px', textAlign: 'center', maxWidth: 300, width: '100%',
          }}>
            <div style={{ fontSize: 7, color: rarColor(rerollingPower.rarity), letterSpacing: '0.15em' }}>
              {rarLabel(rerollingPower.rarity)} · CURRENTLY BOUND:
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)', marginTop: 2 }}>
              {rerollingPower.icon} {rerollingPower.name}
            </div>
            {(() => {
              const cur = ALL_CURSES.find(c => c.id === rerollingEntry.curseId)
              return cur ? (
                <div style={{ fontSize: 9, color: 'var(--accent)', marginTop: 4 }}>
                  {cur.icon} {cur.name} → being replaced
                </div>
              ) : null
            })()}
          </div>

          {/* New curse options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 11, maxWidth: 760, width: '100%' }}>
            {rerollOptions.map(curse => {
              const isChosen = chosenReroll?.id === curse.id
              return (
                <div
                  key={curse.id}
                  onClick={() => setChosenReroll(curse)}
                  style={{
                    background: isChosen ? 'rgba(60,255,180,0.06)' : 'var(--panel)',
                    border: `2px solid ${isChosen ? 'var(--accent3)' : 'var(--border)'}`,
                    padding: 13, cursor: 'pointer', transition: 'all 0.13s',
                    display: 'flex', flexDirection: 'column', gap: 4,
                  }}
                >
                  <div style={{ fontSize: 7, color: rarColor(curse.rarity), letterSpacing: '0.12em' }}>
                    {rarLabel(curse.rarity)} · {curse.cat.toUpperCase()}
                  </div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 17, color: 'var(--accent)' }}>
                    {curse.icon} {curse.name}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', lineHeight: 1.4 }}>{curse.desc}</div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 2 }}>
                    {curse.synergy.map(k => (
                      <span key={k} style={{
                        fontSize: 7, padding: '2px 5px',
                        border: `1px solid ${SYN_COLORS[k] ?? 'var(--border)'}`,
                        color: SYN_COLORS[k] ?? 'var(--muted)',
                      }}>
                        {SYN_TAGS[k]?.label ?? k}
                      </span>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          <div style={{ fontSize: 10, color: 'var(--accent3)', minHeight: 18, textAlign: 'center' }}>
            {chosenReroll
              ? `NEW CURSE: ${chosenReroll.icon} ${chosenReroll.name}`
              : '— select a curse above —'}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-purple" disabled={!chosenReroll} onClick={handleConfirmReroll}>
              ♻ CONFIRM REROLL
            </button>
            <button className="btn btn-secondary" onClick={cancelReroll}>CANCEL</button>
          </div>
        </div>
      )}

      {/* ── REFINE OVERLAY ── */}
      {refiningEntry && refiningPower && (
        <div style={{
          position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          justifyContent: 'center', gap: 18, padding: 28, zIndex: 900,
          overflowY: 'auto', pointerEvents: 'all',
        }}>
          <div style={{ textAlign: 'center' }}>
            <h2 style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 34, color: 'var(--accent2)' }}>
              ⚙ REFINE CARD
            </h2>
            <p style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.15em', marginTop: 3 }}>
              BEHAVIOR UPGRADE · NOT A STAT UPGRADE · COSTS 🪙 {refineCost(refiningPower)}
            </p>
          </div>

          {/* Card display */}
          <div style={{
            background: 'var(--panel)',
            border: `2px solid ${rarColor(refiningPower.rarity)}`,
            padding: '11px 18px', textAlign: 'center', maxWidth: 300, width: '100%',
          }}>
            <div style={{ fontSize: 7, color: rarColor(refiningPower.rarity), letterSpacing: '0.15em' }}>
              {rarLabel(refiningPower.rarity)} · {refiningPower.cat.toUpperCase()}
            </div>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: 'var(--accent2)', marginTop: 2 }}>
              {refiningPower.icon} {refiningPower.name}
            </div>
            <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 3 }}>
              {(refiningEntry.refinements ?? []).length}/2 refinements applied
            </div>
          </div>

          <div style={{ fontSize: 9, color: 'var(--muted)', textAlign: 'center', maxWidth: 480 }}>
            Refinements change <span style={{ color: 'var(--accent2)' }}>how a card plays</span> — not raw numbers.
            Your downside always remains.
          </div>

          {/* Refinement options */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 11, maxWidth: 560, width: '100%' }}>
            {getRefineOptions(refiningPower).map(ref => {
              const alreadyApplied = (refiningEntry.refinements ?? []).includes(ref.id)
              const isChosen = chosenRefine === ref.id
              return (
                <div
                  key={ref.id}
                  onClick={() => !alreadyApplied && setChosenRefine(isChosen ? null : ref.id)}
                  style={{
                    background: alreadyApplied ? 'rgba(60,255,180,0.04)' : isChosen ? 'rgba(255,184,0,0.07)' : 'var(--panel)',
                    border: `2px solid ${alreadyApplied ? 'var(--accent3)' : isChosen ? 'var(--accent2)' : 'var(--border)'}`,
                    padding: 14, cursor: alreadyApplied ? 'default' : 'pointer',
                    transition: 'all 0.13s', opacity: alreadyApplied ? 0.7 : 1,
                  }}
                >
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: alreadyApplied ? 'var(--accent3)' : 'var(--accent2)' }}>
                    {alreadyApplied ? '✓ ' : ''}{ref.name}
                  </div>
                  <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 4, lineHeight: 1.4 }}>
                    {ref.desc}
                  </div>
                  {alreadyApplied && (
                    <div style={{ fontSize: 7, color: 'var(--accent3)', marginTop: 4 }}>ALREADY APPLIED</div>
                  )}
                </div>
              )
            })}
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button
              className="btn btn-gold"
              disabled={!chosenRefine}
              onClick={handleConfirmRefine}
            >
              ⚙ APPLY REFINEMENT
            </button>
            <button className="btn btn-secondary" onClick={cancelRefine}>CANCEL</button>
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
          📁 COLLECTION
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
        Your forged powers. Reroll to change the bound curse. Refine to improve how the card plays.
      </div>

      {/* ── AD SLOT ── */}
      <div id="ad-slot-collection-banner" style={{
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
        {(['all', 'common', 'rare', 'epic', 'legendary', 'mythical'] as RarFilter[]).map(r => (
          <div
            key={r}
            onClick={() => setRarFilter(r)}
            style={{
              fontSize: 8, letterSpacing: '0.08em', padding: '2px 9px',
              border: `1px solid ${rarFilter === r ? (r === 'all' ? 'var(--accent2)' : rarColor(r as any)) : 'var(--border)'}`,
              color: rarFilter === r ? (r === 'all' ? 'var(--accent2)' : rarColor(r as any)) : 'var(--muted)',
              cursor: 'pointer', fontFamily: "'Bebas Neue', sans-serif",
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

      {/* ── COUNT ── */}
      <div style={{ fontSize: 9, color: 'var(--muted)' }}>
        <span style={{ color: 'var(--accent3)' }}>{visible.length}</span> card{visible.length !== 1 ? 's' : ''}
        {rarFilter !== 'all' || catFilter !== 'all' ? ' (filtered)' : ' total'}
        {' · '}
        <span
          style={{ color: 'var(--accent2)', cursor: 'pointer', textDecoration: 'underline' }}
          onClick={() => setScreen('shop')}
        >
          Get more in the Shop →
        </span>
      </div>

      {/* ── CARD GRID ── */}
      {visible.length === 0 ? (
        <div style={{
          textAlign: 'center', padding: 40, color: 'var(--muted)', fontSize: 11,
          border: '1px dashed var(--border)',
        }}>
          No cards match this filter.
          <br />
          <span
            style={{ color: 'var(--accent2)', cursor: 'pointer', textDecoration: 'underline', marginTop: 6, display: 'inline-block' }}
            onClick={() => { setRarFilter('all'); setCatFilter('all') }}
          >
            Clear filters
          </span>
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
          gap: 10,
        }}>
          {visible.map(entry => {
            const power = ALL_POWERS.find(p => p.id === entry.powerId)
            const curse = ALL_CURSES.find(c => c.id === entry.curseId)
            if (!power || !curse) return null
            const rc       = rarColor(power.rarity)
            const refs     = entry.refinements ?? []
            const refOpts  = getRefineOptions(power)
            const reRCost  = rerollCost(entry, power)
            const refCost  = refineCost(power)
            const canReroll = power.rarity !== 'mythical'
            const canRefine = refs.length < 2 && power.rarity !== 'mythical'

            return (
              <div
                key={entry.powerId}
                style={{
                  background: 'var(--panel)',
                  border: `2px solid ${rc}`,
                  padding: 12, display: 'flex', flexDirection: 'column', gap: 5,
                  position: 'relative',
                }}
              >
                {/* Starter badge */}
                {entry.isStarter && (
                  <div style={{
                    position: 'absolute', top: 7, right: 7,
                    fontSize: 7, letterSpacing: '0.08em', padding: '1px 5px',
                    border: `1px solid var(--accent3)`, color: 'var(--accent3)',
                  }}>
                    ★ STARTER
                  </div>
                )}

                {/* Rarity + category */}
                <div style={{ fontSize: 7, color: rc, letterSpacing: '0.13em' }}>
                  {rarLabel(power.rarity)} · {power.cat.toUpperCase()}
                </div>

                {/* Power half */}
                <div style={{ borderBottom: '1px solid var(--border)', paddingBottom: 6, marginBottom: 2 }}>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: 'var(--accent2)' }}>
                    {power.icon} {power.name}
                  </div>
                  <div style={{ fontSize: 7, color: 'var(--muted)', marginTop: 2, lineHeight: 1.35 }}>
                    {power.desc}
                  </div>
                  {power.damage && (
                    <div style={{ fontSize: 7, color: 'var(--text)', marginTop: 3 }}>
                      💥 {power.damage} dmg · range {power.range}
                    </div>
                  )}
                  {power.heal && (
                    <div style={{ fontSize: 7, color: 'var(--accent3)', marginTop: 3 }}>
                      💚 {power.heal} heal · range {power.range}
                    </div>
                  )}
                </div>

                {/* Curse half */}
                <div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--accent)' }}>
                    {curse.icon} {curse.name}
                  </div>
                  <div style={{ fontSize: 7, color: 'rgba(255,60,60,0.65)', lineHeight: 1.35, marginTop: 2 }}>
                    {curse.desc}
                  </div>
                  <div style={{ display: 'flex', gap: 3, flexWrap: 'wrap', marginTop: 4 }}>
                    {curse.synergy.map(k => (
                      <span key={k} style={{
                        fontSize: 6, padding: '1px 4px',
                        border: `1px solid ${SYN_COLORS[k] ?? 'var(--border)'}`,
                        color: SYN_COLORS[k] ?? 'var(--muted)',
                      }}>
                        {SYN_TAGS[k]?.label ?? k}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Refinement pips */}
                {refOpts.length > 0 && (
                  <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
                    {refOpts.map(r => {
                      const applied = refs.includes(r.id)
                      return (
                        <div key={r.id} style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 7, color: applied ? 'var(--accent3)' : 'var(--muted)',
                        }}>
                          <div style={{
                            width: 6, height: 6, borderRadius: '50%',
                            background: applied ? 'var(--accent3)' : 'var(--border)',
                            flexShrink: 0,
                          }} />
                          {r.name}
                        </div>
                      )
                    })}
                  </div>
                )}

                {/* Action buttons */}
                {power.rarity !== 'mythical' ? (
                  <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap', alignItems: 'center' }}>
                    {canRefine && (
                      <button
                        className="btn btn-gold"
                        style={{ fontSize: 9, padding: '3px 8px' }}
                        onClick={() => openRefine(entry, power)}
                        disabled={save.coins < refCost}
                        title={save.coins < refCost ? `Need 🪙${refCost}` : ''}
                      >
                        ⚙ REFINE
                      </button>
                    )}
                    {refs.length >= 2 && (
                      <span style={{ fontSize: 7, color: 'var(--accent3)' }}>⚙ MAX REFINED</span>
                    )}
                    {canReroll && (
                      <button
                        className="btn btn-purple"
                        style={{ fontSize: 9, padding: '3px 8px' }}
                        onClick={() => openReroll(entry, power)}
                        disabled={save.diamonds < reRCost}
                        title={save.diamonds < reRCost ? `Need 💎${reRCost}` : ''}
                      >
                        ♻ REROLL
                      </button>
                    )}
                    <span style={{ fontSize: 7, color: 'var(--muted)', marginLeft: 2 }}>
                      {canReroll ? `💎${reRCost}` : ''}
                      {canRefine && canReroll ? ' · ' : ''}
                      {canRefine ? `🪙${refCost}` : ''}
                    </span>
                  </div>
                ) : (
                  <div style={{
                    fontSize: 7, letterSpacing: '0.1em', padding: '1px 5px',
                    border: '1px solid var(--border)', color: 'var(--muted)',
                    display: 'inline-block', marginTop: 4,
                  }}>
                    🔒 EVENT-ONLY
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      <div style={{ height: 24 }} />
    </div>
  )
}