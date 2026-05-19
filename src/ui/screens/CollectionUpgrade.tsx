import React, { useState } from 'react'
import { useStore } from '@store'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { rarColor, rarLabel } from '@data/rarity'
import { getUpgradeTier, MAX_LEVEL, getLevelBonus } from '@data/packs'
import { save } from '@systems/SaveManager'
import type { ForgedEntry } from '@data/types'

// ============================================================
// COLLECTION UPGRADE PANEL
// Shows card level, duplicate count, upgrade requirements.
// Import and use this inside CollectionScreen.
// ============================================================

interface Props {
  entry:    ForgedEntry
  onClose:  () => void
  onUpgrade: (entry: ForgedEntry) => void
}

export default function CollectionUpgrade({ entry, onClose, onUpgrade }: Props) {
  const { coins, updateForged, forged } = useStore()
  const power    = ALL_POWERS.find(p => p.id === entry.powerId)
  const curse    = ALL_CURSES.find(c => c.id === entry.curseId)
  const level    = entry.level    ?? 1
  const dupes    = entry.duplicates ?? 0
  const nextTier = getUpgradeTier(level)
  const rc       = power ? rarColor(power.rarity) : 'var(--accent2)'

  const canUpgrade = nextTier
    && dupes    >= nextTier.dupes
    && coins    >= nextTier.coins
    && level    <  MAX_LEVEL

  function handleUpgrade() {
    if (!canUpgrade || !nextTier) return
    const newForged = forged.map(f => {
      if (f.powerId !== entry.powerId) return f
      return {
        ...f,
        level:      (f.level ?? 1) + 1,
        duplicates: (f.duplicates ?? 0) - nextTier.dupes,
      }
    })
    save.coins -= nextTier.coins
    save.persistCoins()
    save.forged = newForged
    save.persistForged()
    useStore.setState({ coins: save.coins })
    updateForged(newForged)
    onUpgrade(newForged.find(f => f.powerId === entry.powerId)!)
  }

  if (!power || !curse) return null

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:400, padding:20, pointerEvents:'all' }}>
      <div style={{ background:'var(--panel)', border:`2px solid ${rc}`, padding:'20px 24px', maxWidth:420, width:'100%', display:'flex', flexDirection:'column', gap:14 }}>

        {/* Header */}
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
          <div>
            <div style={{ fontSize:8, color:rc, letterSpacing:'0.14em', fontFamily:"'Bebas Neue', sans-serif" }}>{rarLabel(power.rarity)}</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:26, color:'var(--accent2)' }}>{power.icon} {power.name}</div>
            <div style={{ fontSize:9, color:'#ff8080' }}>{curse.icon} {curse.name}</div>
          </div>
          <span style={{ cursor:'pointer', color:'var(--muted)', fontSize:16 }} onClick={onClose}>✕</span>
        </div>

        {/* Level display */}
        <div style={{ display:'flex', gap:4 }}>
          {Array.from({ length:MAX_LEVEL }, (_, i) => (
            <div key={i} style={{ flex:1, height:6, background:i < level ? rc : 'var(--border)', borderRadius:2, transition:'background 0.2s' }} />
          ))}
        </div>

        <div style={{ display:'flex', gap:16, justifyContent:'center' }}>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:32, color:rc }}>{level}</div>
            <div style={{ fontSize:8, color:'var(--muted)', letterSpacing:'0.1em' }}>LEVEL</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:32, color:'var(--accent3)' }}>+{Math.round((getLevelBonus(level)-1)*100)}%</div>
            <div style={{ fontSize:8, color:'var(--muted)', letterSpacing:'0.1em' }}>DAMAGE BONUS</div>
          </div>
          <div style={{ textAlign:'center' }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:32, color:'var(--accent2)' }}>{dupes}</div>
            <div style={{ fontSize:8, color:'var(--muted)', letterSpacing:'0.1em' }}>DUPLICATES</div>
          </div>
        </div>

        {/* Upgrade requirements */}
        {level < MAX_LEVEL ? (
          <div style={{ background:'var(--panel2)', padding:'12px 16px', border:'1px solid var(--border)' }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:13, color:'var(--accent2)', letterSpacing:'0.1em', marginBottom:8 }}>
              UPGRADE TO LEVEL {level + 1}
            </div>
            {nextTier && (
              <>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:4 }}>
                  <span style={{ color:'var(--muted)' }}>Duplicates needed:</span>
                  <span style={{ color:dupes >= nextTier.dupes ? 'var(--accent3)' : 'var(--accent)' }}>
                    {dupes}/{nextTier.dupes} {dupes >= nextTier.dupes ? '✓' : `(need ${nextTier.dupes - dupes} more)`}
                  </span>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between', fontSize:10, marginBottom:10 }}>
                  <span style={{ color:'var(--muted)' }}>Coins needed:</span>
                  <span style={{ color:coins >= nextTier.coins ? 'var(--accent3)' : 'var(--accent)' }}>
                    🪙{nextTier.coins.toLocaleString()} {coins >= nextTier.coins ? '✓' : `(need ${(nextTier.coins - coins).toLocaleString()} more)`}
                  </span>
                </div>
                <div style={{ fontSize:9, color:'var(--muted)', marginBottom:10 }}>
                  After upgrade: <span style={{ color:'var(--accent3)' }}>+{Math.round((getLevelBonus(level+1)-1)*100)}% damage bonus</span>
                </div>
                <button className="btn btn-confirm" style={{ width:'100%', fontSize:14 }} disabled={!canUpgrade} onClick={handleUpgrade}>
                  {canUpgrade ? `⬆ UPGRADE TO LEVEL ${level+1}` : 'REQUIREMENTS NOT MET'}
                </button>
              </>
            )}
          </div>
        ) : (
          <div style={{ background:'rgba(60,255,180,0.06)', border:'1px solid var(--accent3)', padding:'12px 16px', textAlign:'center' }}>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color:'var(--accent3)' }}>★ MAX LEVEL</div>
            <div style={{ fontSize:9, color:'var(--muted)', marginTop:4 }}>This card is fully upgraded. +45% damage bonus active.</div>
          </div>
        )}

        <div style={{ fontSize:8, color:'var(--muted)', lineHeight:1.6 }}>
          Get duplicates by opening card packs. The level bonus applies to all damage and healing in battle.
        </div>
      </div>
    </div>
  )
}