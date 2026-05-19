import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import { supabase } from '@lib/supabase'
import { getVIPTier, getNextVIPTier, VIP_TIERS } from '@lib/VIPSystem'
import { getRankInfo } from '@lib/RankSystem'
import { ALL_POWERS } from '@data/powers'
import { getMythicalProgress, loadMythicalProgress } from '@lib/MythicalEventManager'
import { getActiveEvent } from '@data/mythicalEvents'
import { rarColor } from '@data/rarity'

// ============================================================
// PROFILE SCREEN
// Shows VIP tier, rank, win/loss, owned mythicals,
// spending progress, and account info.
// ============================================================

interface PlayerStats {
  mmr:               number
  wins:              number
  losses:            number
  placement_done:    boolean
  placements_played: number
  rank_tier:         string
}

export default function ProfileScreen() {
  const { setScreen, authUser, coins, diamonds, forged } = useStore()
  const [stats,       setStats]       = useState<PlayerStats | null>(null)
  const [totalSpent,  setTotalSpent]  = useState(0)
  const [loading,     setLoading]     = useState(true)
  const [mythProg,    setMythProg]    = useState(getMythicalProgress())

  useEffect(() => {
    if (!authUser) return
    loadAll()
  }, [authUser])

  async function loadAll() {
    setLoading(true)
    const [statsRes, saveRes] = await Promise.all([
      supabase.from('player_stats').select('*').eq('player_id', authUser!.id).single(),
      supabase.from('saves').select('total_spent').eq('player_id', authUser!.id).single(),
    ])
    if (statsRes.data) setStats(statsRes.data)
    if (saveRes.data)  setTotalSpent(saveRes.data.total_spent ?? 0)
    const mp = await loadMythicalProgress(authUser!.id)
    setMythProg({ ...mp })
    setLoading(false)
  }

  if (!authUser) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, background:'var(--bg)', pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:'var(--accent2)' }}>👤 PROFILE</div>
      <div style={{ fontSize:11, color:'var(--muted)' }}>Sign in to view your profile.</div>
      <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
    </div>
  )

  const vip      = getVIPTier(totalSpent)
  const nextVip  = getNextVIPTier(totalSpent)
  const rankInfo = stats ? getRankInfo(stats.mmr, stats.placement_done) : null
  const winRate  = stats && (stats.wins + stats.losses) > 0
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100) : 0

  const event = getActiveEvent()
  const ownedMythicals = mythProg.mythicalsOwned ?? []
  const mythicalPowers = ownedMythicals.map(eventId => {
    const ev = event?.id === eventId ? event : null
    return ev ? ALL_POWERS.find(p => p.id === ev.powerId) : null
  }).filter(Boolean)

  const vipProgress = nextVip
    ? Math.min(100, ((totalSpent - vip.minSpend) / (nextVip.minSpend - vip.minSpend)) * 100)
    : 100

  return (
    <div style={{ display:'flex', flexDirection:'column', minHeight:'100vh', background:'var(--bg)', overflowY:'auto', pointerEvents:'all', padding:'0 0 40px' }}>

      {/* Hero banner */}
      <div style={{ background:`linear-gradient(135deg, ${vip.color}22, var(--panel))`, borderBottom:`2px solid ${vip.color}`, padding:'24px 24px 20px', position:'relative' }}>
        <button className="btn btn-secondary" style={{ position:'absolute', top:14, right:16, fontSize:10 }} onClick={() => setScreen('title')}>← BACK</button>

        <div style={{ display:'flex', alignItems:'center', gap:16, flexWrap:'wrap' }}>
          {/* Avatar */}
          <div style={{ width:72, height:72, borderRadius:'50%', background:`linear-gradient(135deg, ${vip.color}44, var(--panel2))`, border:`3px solid ${vip.color}`, display:'flex', alignItems:'center', justifyContent:'center', fontSize:32, flexShrink:0 }}>
            {vip.icon}
          </div>

          {/* Name + VIP */}
          <div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:'var(--text)', lineHeight:1 }}>{authUser.username}</div>
            <div style={{ display:'flex', alignItems:'center', gap:8, marginTop:4 }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, color:vip.color, border:`1px solid ${vip.color}`, padding:'2px 8px', letterSpacing:'0.1em' }}>
                {vip.icon} {vip.name}
              </div>
              {rankInfo && (
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, color:rankInfo.color, border:`1px solid ${rankInfo.color}44`, padding:'2px 8px' }}>
                  {rankInfo.icon} {rankInfo.label}
                </div>
              )}
            </div>
            <div style={{ fontSize:9, color:'var(--muted)', marginTop:4 }}>{authUser.email}</div>
          </div>
        </div>
      </div>

      <div style={{ padding:'16px 20px', display:'flex', flexDirection:'column', gap:14, maxWidth:800, margin:'0 auto', width:'100%' }}>

        {loading && <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', padding:20 }}>Loading profile...</div>}

        {!loading && (
          <>
            {/* ── STATS ROW ── */}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(120px,1fr))', gap:8 }}>
              {[
                { label:'COINS',     value:`🪙 ${coins.toLocaleString()}`,    color:'var(--accent2)' },
                { label:'DIAMONDS',  value:`💎 ${diamonds}`,                  color:'var(--purple)'  },
                { label:'TICKETS',   value:`🎫 ${mythProg.tickets}`,          color:'var(--accent3)' },
                { label:'WINS',      value:`⚔ ${stats?.wins ?? 0}`,           color:'var(--accent3)' },
                { label:'LOSSES',    value:`💀 ${stats?.losses ?? 0}`,        color:'var(--accent)'  },
                { label:'WIN RATE',  value:`${winRate}%`,                      color:'var(--accent2)' },
                { label:'MMR',       value:`${stats?.mmr ?? 0}`,              color:rankInfo?.color ?? 'var(--muted)' },
                { label:'CARDS',     value:`📦 ${forged.length}`,             color:'var(--accent2)' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'10px 12px', textAlign:'center' }}>
                  <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color }}>{value}</div>
                  <div style={{ fontSize:7, color:'var(--muted)', letterSpacing:'0.12em', marginTop:2 }}>{label}</div>
                </div>
              ))}
            </div>

            {/* ── VIP STATUS ── */}
            <div style={{ background:'var(--panel)', border:`2px solid ${vip.color}`, padding:'16px 18px', boxShadow:`0 0 16px ${vip.color}22` }}>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                <div>
                  <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:9, color:'var(--muted)', letterSpacing:'0.14em' }}>VIP STATUS</div>
                  <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24, color:vip.color }}>{vip.icon} {vip.name}</div>
                  <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>Total spent: <span style={{ color:'var(--text)' }}>${totalSpent.toFixed(2)}</span></div>
                </div>
                {nextVip && (
                  <div style={{ textAlign:'right', fontSize:9, color:'var(--muted)' }}>
                    <div>Next tier: <span style={{ color:nextVip.color }}>{nextVip.icon} {nextVip.name}</span></div>
                    <div style={{ marginTop:2 }}>Spend <span style={{ color:'var(--text)' }}>${(nextVip.minSpend - totalSpent).toFixed(2)}</span> more</div>
                  </div>
                )}
              </div>

              {/* VIP progress bar */}
              <div style={{ background:'var(--panel2)', height:6, borderRadius:3, overflow:'hidden', marginBottom:12 }}>
                <div style={{ height:'100%', background:vip.color, width:`${vipProgress}%`, transition:'width 0.4s', borderRadius:3 }} />
              </div>

              {/* VIP tier track */}
              <div style={{ display:'flex', gap:0, position:'relative', paddingBottom:20 }}>
                <div style={{ position:'absolute', top:12, left:0, right:0, height:2, background:'var(--border)' }} />
                {VIP_TIERS.map((tier, i) => {
                  const reached = totalSpent >= tier.minSpend
                  return (
                    <div key={tier.name} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1 }}>
                      <div style={{ width:24, height:24, borderRadius:'50%', background:reached?tier.color:'var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, border:`2px solid ${reached?tier.color:'var(--border)'}` }}>
                        {reached ? tier.icon : ''}
                      </div>
                      <div style={{ position:'absolute', top:28, fontSize:6, color:reached?tier.color:'var(--muted)', textAlign:'center', whiteSpace:'nowrap' }}>{tier.name}</div>
                    </div>
                  )
                })}
              </div>

              {/* Current perks */}
              <div style={{ marginTop:8 }}>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:'var(--muted)', letterSpacing:'0.1em', marginBottom:6 }}>YOUR PERKS</div>
                <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                  {vip.perks.map(perk => (
                    <div key={perk} style={{ fontSize:10, color:'var(--text)', display:'flex', gap:6, alignItems:'center' }}>
                      <span style={{ color:vip.color }}>✓</span> {perk}
                    </div>
                  ))}
                </div>
                {nextVip && (
                  <div style={{ marginTop:10, paddingTop:10, borderTop:'1px solid var(--border)' }}>
                    <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:'var(--muted)', letterSpacing:'0.1em', marginBottom:6 }}>UNLOCKS AT {nextVip.name}</div>
                    {nextVip.perks.filter(p => !vip.perks.includes(p)).map(perk => (
                      <div key={perk} style={{ fontSize:10, color:'var(--muted)', display:'flex', gap:6, alignItems:'center' }}>
                        <span style={{ color:'var(--muted)' }}>○</span> {perk}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── RANK ── */}
            {rankInfo && (
              <div style={{ background:'var(--panel)', border:`1px solid ${rankInfo.color}`, padding:'14px 18px' }}>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:9, color:'var(--muted)', letterSpacing:'0.14em', marginBottom:6 }}>COMPETITIVE RANK</div>
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ fontSize:40 }}>{rankInfo.icon}</div>
                  <div>
                    <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:rankInfo.color, lineHeight:1 }}>{rankInfo.label}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', marginTop:4 }}>
                      {stats?.mmr ?? 0} MMR · {stats?.wins ?? 0}W {stats?.losses ?? 0}L · {winRate}% win rate
                    </div>
                    {!stats?.placement_done && (
                      <div style={{ fontSize:9, color:'var(--accent2)', marginTop:3 }}>
                        {5 - (stats?.placements_played ?? 0)} placement matches remaining
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── MYTHICAL POWERS ── */}
            <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'14px 18px' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:9, color:'var(--muted)', letterSpacing:'0.14em', marginBottom:10 }}>☠ MYTHICAL POWERS OWNED</div>
              {mythicalPowers.length === 0 ? (
                <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.6 }}>
                  No mythical powers yet. Earn them through the Mythical Event — dungeon battles or roulette spins.
                </div>
              ) : (
                <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                  {mythicalPowers.map((power: any, i) => (
                    <div key={i} style={{ background:'var(--panel2)', border:'1px solid var(--r-mythical)', padding:'10px 14px', textAlign:'center', minWidth:100 }}>
                      <div style={{ fontSize:28 }}>{power.icon}</div>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:'var(--r-mythical)', marginTop:4 }}>{power.name}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* ── COLLECTION SUMMARY ── */}
            <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'14px 18px' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:9, color:'var(--muted)', letterSpacing:'0.14em', marginBottom:10 }}>COLLECTION SUMMARY</div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(100px,1fr))', gap:6 }}>
                {(['common','rare','epic','legendary','mythical'] as const).map(rarity => {
                  const count = forged.filter(f => ALL_POWERS.find(p => p.id === f.powerId)?.rarity === rarity).length
                  const rc    = rarColor(rarity)
                  return (
                    <div key={rarity} style={{ textAlign:'center', padding:'8px 6px', border:`1px solid ${rc}44`, background:`${rc}11` }}>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:rc }}>{count}</div>
                      <div style={{ fontSize:7, color:'var(--muted)', textTransform:'capitalize', letterSpacing:'0.08em' }}>{rarity}</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── QUICK ACTIONS ── */}
            <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
              <button className="btn btn-primary" onClick={() => setScreen('multiplayer')}>⚔ RANKED BATTLE</button>
              <button className="btn btn-gold" onClick={() => setScreen('packs')}>📦 OPEN PACKS</button>
              <button className="btn btn-purple" onClick={() => setScreen('mythical')}>☠ MYTHICAL EVENT</button>
              <button className="btn btn-secondary" onClick={() => setScreen('collection')}>📁 COLLECTION</button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}