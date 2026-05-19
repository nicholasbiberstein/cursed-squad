import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import {
  loadMythicalProgress, getMythicalProgress, doSpin,
  canFreeSpin, hasPaidSpins, buyTicketItem,
  FREE_SPINS_PER_DAY, SPIN_DIAMOND_COST,
} from '@lib/MythicalEventManager'
import {
  getActiveEvent, getDaysRemaining, ROULETTE_PRIZES,
  SPIN_PACKS, TICKET_STORE, DUNGEON_LEVELS,
  type RoulettePrize,
} from '@data/mythicalEvents'
import { ALL_POWERS } from '@data/powers'
import { rarColor } from '@data/rarity'

type Tab = 'roulette' | 'dungeon' | 'tickets' | 'packs'

export default function MythicalEventScreen() {
  const { setScreen, authUser, diamonds, forged } = useStore()
  const [tab,         setTab]         = useState<Tab>('roulette')
  const [loaded,      setLoaded]      = useState(false)
  const [prog,        setProg]        = useState(getMythicalProgress())
  const [spinning,    setSpinning]    = useState(false)
  const [lastPrize,   setLastPrize]   = useState<RoulettePrize | null>(null)
  const [angle,       setAngle]       = useState(0)
  const [msg,         setMsg]         = useState<string | null>(null)
  const [showCursePick, setShowCursePick] = useState(false)

  const event = getActiveEvent()

  useEffect(() => {
    if (!authUser) return
    loadMythicalProgress(authUser.id).then(p => { setProg({ ...p }); setLoaded(true) })
  }, [authUser])

  function refresh() { setProg({ ...getMythicalProgress() }) }
  function notify(m: string) { setMsg(m); setTimeout(() => setMsg(null), 3000) }

  async function handleSpin(isPaid: boolean) {
    if (!authUser || spinning) return
    setSpinning(true); setLastPrize(null)
    const spins  = 4 + Math.random() * 3
    const target = spins * 360 + Math.random() * 360
    setAngle(prev => prev + target)
    setTimeout(async () => {
      const result = await doSpin(authUser.id, isPaid)
      if (!result) { notify('Cannot spin right now.'); setSpinning(false); return }
      setLastPrize(result.prize)
      setSpinning(false)
      refresh()
      if (result.prize.type === 'mythical_power') {
        const { pendingMythicalPowerId } = useStore.getState() as any
        if (pendingMythicalPowerId) setShowCursePick(true)
      }
    }, 3000)
  }

  async function handleTicketBuy(itemId: string) {
    if (!authUser) return
    const ok = await buyTicketItem(authUser.id, itemId)
    if (ok) { notify('Item purchased!'); refresh() }
    else notify('Not enough tickets or already purchased.')
  }

  const power       = event ? ALL_POWERS.find(p => p.id === event.powerId) : null
  const daysLeft    = event ? getDaysRemaining(event) : 0
  const spinsLeft   = FREE_SPINS_PER_DAY - prog.spinsToday
  const ownsMythical = event ? prog.mythicalsOwned.includes(event.id) : false

  if (!event) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, background:'var(--bg)', pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:'var(--muted)' }}>NO ACTIVE EVENT</div>
      <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', maxWidth:320, lineHeight:1.7 }}>Check back soon for the next mythical event.</div>
      <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
    </div>
  )

  if (!authUser) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, background:'var(--bg)', pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:'var(--accent2)' }}>☠ MYTHICAL EVENT</div>
      <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', maxWidth:320, lineHeight:1.7 }}>Sign in to participate in mythical events.</div>
      <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
    </div>
  )

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflowY:'auto', pointerEvents:'all' }}>

      {/* Toast */}
      {msg && <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)', background:'var(--panel)', border:`1px solid ${event.color}`, color:event.color, padding:'8px 20px', fontSize:11, fontFamily:"'Bebas Neue', sans-serif", letterSpacing:'0.1em', zIndex:1000, whiteSpace:'nowrap' }}>{msg}</div>}

      {/* Header */}
      <div style={{ background:'var(--panel)', borderBottom:`2px solid ${event.color}`, padding:'12px 18px', boxShadow:`0 0 24px ${event.color}33`, flexShrink:0 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', flexWrap:'wrap', gap:8 }}>
          <div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:event.color, letterSpacing:'0.2em' }}>☠ MYTHICAL EVENT</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:'var(--text)', lineHeight:1 }}>{event.name}</div>
            <div style={{ fontSize:9, color:'var(--muted)', marginTop:3 }}>{event.desc}</div>
          </div>
          <div style={{ display:'flex', gap:8, alignItems:'center', flexWrap:'wrap' }}>
            <div style={{ background:'var(--panel2)', border:`1px solid ${event.color}`, padding:'6px 12px', textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:event.color }}>{daysLeft}</div>
              <div style={{ fontSize:7, color:'var(--muted)', letterSpacing:'0.1em' }}>DAYS LEFT</div>
            </div>
            <div style={{ background:'var(--panel2)', border:'1px solid var(--purple)', padding:'6px 12px', textAlign:'center' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:'var(--purple)' }}>{prog.tickets}</div>
              <div style={{ fontSize:7, color:'var(--muted)', letterSpacing:'0.1em' }}>TICKETS</div>
            </div>
            <button className="btn btn-secondary" style={{ fontSize:10 }} onClick={() => setScreen('title')}>← BACK</button>
          </div>
        </div>

        {/* Featured power */}
        {power && (
          <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:12, background:'rgba(0,0,0,0.3)', padding:'10px 14px', border:`1px solid ${event.color}44` }}>
            <div style={{ fontSize:32 }}>{power.icon}</div>
            <div>
              <div style={{ fontSize:7, color:event.color, letterSpacing:'0.14em', fontFamily:"'Bebas Neue', sans-serif" }}>FEATURED MYTHICAL POWER</div>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:20, color:'var(--r-mythical)' }}>{power.name}</div>
              <div style={{ fontSize:9, color:'var(--muted)' }}>{power.desc}</div>
            </div>
            {ownsMythical && <div style={{ marginLeft:'auto', fontSize:10, color:'var(--accent3)', border:'1px solid var(--accent3)', padding:'4px 10px', fontFamily:"'Bebas Neue', sans-serif" }}>✓ OWNED</div>}
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--panel)', flexShrink:0 }}>
        {(['roulette','dungeon','tickets','packs'] as const).map(t => (
          <div key={t} onClick={() => setTab(t)} style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:12, letterSpacing:'0.08em', padding:'10px 14px', cursor:'pointer', borderBottom:`2px solid ${tab===t?event.color:'transparent'}`, color:tab===t?event.color:'var(--muted)', transition:'all 0.12s', whiteSpace:'nowrap' }}>
            {t==='roulette'?'🎰 ROULETTE':t==='dungeon'?'⚔ DUNGEON':t==='tickets'?'🎫 TICKET STORE':'💳 SPIN PACKS'}
          </div>
        ))}
      </div>

      <div style={{ flex:1, padding:'16px 18px', maxWidth:860, margin:'0 auto', width:'100%' }}>

        {/* ── ROULETTE ── */}
        {tab === 'roulette' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>

            {/* Spin info */}
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', justifyContent:'center' }}>
              <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'10px 18px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:'var(--accent2)' }}>{spinsLeft}/{FREE_SPINS_PER_DAY}</div>
                <div style={{ fontSize:8, color:'var(--muted)' }}>FREE SPINS TODAY · 💎{SPIN_DIAMOND_COST} EACH</div>
              </div>
              <div style={{ background:'var(--panel)', border:'1px solid var(--purple)', padding:'10px 18px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:'var(--purple)' }}>{prog.paidSpins}</div>
                <div style={{ fontSize:8, color:'var(--muted)' }}>PAID SPINS AVAILABLE</div>
              </div>
              <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'10px 18px', textAlign:'center' }}>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:'var(--accent2)' }}>{prog.tickets}</div>
                <div style={{ fontSize:8, color:'var(--muted)' }}>TICKETS (1 per spin)</div>
              </div>
            </div>

            {/* Roulette wheel SVG */}
            <div style={{ position:'relative', width:280, height:300 }}>
              <div style={{ position:'absolute', top:0, left:'50%', transform:'translateX(-50%)', fontSize:24, zIndex:10, filter:'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>▼</div>
              <div style={{ marginTop:16 }}>
                {(() => {
                  const size=260, cx=130, cy=130, r=120
                  const total = ROULETTE_PRIZES.reduce((s,p)=>s+p.weight,0)
                  let cur = -90
                  return (
                    <svg width={size} height={size} style={{ transform:`rotate(${angle}deg)`, transition:'transform 3s cubic-bezier(0.17,0.67,0.12,0.99)', display:'block' }}>
                      {ROULETTE_PRIZES.map((prize, i) => {
                        const deg=((prize.weight/total)*360), start=cur, end=cur+deg; cur=end
                        const sr=(start*Math.PI/180), er=(end*Math.PI/180)
                        const x1=cx+r*Math.cos(sr),y1=cy+r*Math.sin(sr)
                        const x2=cx+r*Math.cos(er),y2=cy+r*Math.sin(er)
                        const large=deg>180?1:0
                        const mr=((start+deg/2)*Math.PI/180)
                        const ix=cx+r*0.65*Math.cos(mr), iy=cy+r*0.65*Math.sin(mr)
                        const colors=['#1a1a2e','#16213e','#0f3460','#1a1830','#12172b','#0a1128','#1a1020','#0d0d1a']
                        return (
                          <g key={i}>
                            <path d={`M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`} fill={prize.special?'#2a0a0a':colors[i%colors.length]} stroke={prize.special?event.color:'#333'} strokeWidth={prize.special?2:1} />
                            <text x={ix} y={iy} textAnchor="middle" dominantBaseline="middle" fontSize={prize.special?20:16}>{prize.icon}</text>
                          </g>
                        )
                      })}
                      <circle cx={cx} cy={cy} r={20} fill="#07070d" stroke={event.color} strokeWidth={3} />
                      <text x={cx} y={cy} textAnchor="middle" dominantBaseline="middle" fontSize={14}>☠</text>
                    </svg>
                  )
                })()}
              </div>
            </div>

            {/* Last prize */}
            {lastPrize && (
              <div style={{ background:'var(--panel)', border:`2px solid ${lastPrize.special?event.color:'var(--border)'}`, padding:'16px 28px', textAlign:'center', boxShadow:lastPrize.special?`0 0 24px ${event.color}66`:'none', minWidth:220 }}>
                <div style={{ fontSize:40 }}>{lastPrize.icon}</div>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24, color:lastPrize.special?event.color:'var(--text)', marginTop:8 }}>{lastPrize.label}</div>
                <div style={{ fontSize:9, color:'var(--accent3)', marginTop:4 }}>+ 1 🎫 ticket</div>
                {lastPrize.special && <div style={{ fontSize:11, color:event.color, marginTop:6, letterSpacing:'0.12em', fontFamily:"'Bebas Neue', sans-serif" }}>★ MYTHICAL POWER UNLOCKED!</div>}
              </div>
            )}

            {/* Spin buttons */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
              <button className="btn btn-primary" style={{ fontSize:16, padding:'12px 28px' }} disabled={spinning||spinsLeft<=0||diamonds<SPIN_DIAMOND_COST} onClick={() => handleSpin(false)}>
                {spinning ? 'SPINNING...' : `🎰 FREE SPIN (💎${SPIN_DIAMOND_COST})`}
              </button>
              {prog.paidSpins > 0 && (
                <button className="btn btn-purple" style={{ fontSize:16, padding:'12px 28px' }} disabled={spinning} onClick={() => handleSpin(true)}>
                  🎰 PAID SPIN ({prog.paidSpins} left)
                </button>
              )}
              <button className="btn btn-gold" style={{ fontSize:12 }} onClick={() => setTab('packs')}>
                💳 GET MORE SPINS
              </button>
            </div>

            {/* Odds */}
            <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'12px 16px', width:'100%', maxWidth:380 }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:12, color:'var(--muted)', letterSpacing:'0.12em', marginBottom:8 }}>PRIZES + ODDS</div>
              <div style={{ fontSize:8, color:'var(--muted)', marginBottom:6 }}>Every spin also gives +1 🎫 ticket</div>
              {ROULETTE_PRIZES.map(p => (
                <div key={p.id} style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--muted)', marginBottom:3 }}>
                  <span>{p.icon} {p.label}</span>
                  <span style={{ color:p.special?event.color:'var(--muted)' }}>{p.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── DUNGEON ── */}
        {tab === 'dungeon' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ background:'var(--panel)', border:`2px solid ${event.color}`, padding:'16px 20px' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24, color:event.color }}>⚔ MYTHICAL DUNGEON</div>
              <div style={{ fontSize:10, color:'var(--muted)', marginTop:4, lineHeight:1.7 }}>
                Fight through 5 escalating levels. Your squad's HP carries over between levels — make it count. Choose a powerup between each level. Defeat the boss to earn the mythical power.
              </div>
              {prog.dungeonLevel > 0 && (
                <div style={{ marginTop:8, padding:'8px 12px', background:'rgba(255,184,0,0.08)', border:'1px solid var(--accent2)', fontSize:10, color:'var(--accent2)' }}>
                  ⏳ IN PROGRESS — You're on Level {prog.dungeonLevel}. Your progress is saved.
                </div>
              )}
            </div>

            {/* Level map */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {DUNGEON_LEVELS.map((lvl, i) => {
                const done    = prog.dungeonLevel > lvl.level
                const current = prog.dungeonLevel === lvl.level
                const locked  = prog.dungeonLevel < lvl.level
                return (
                  <div key={lvl.level} style={{ background:'var(--panel)', border:`2px solid ${done?'var(--accent3)':current?event.color:lvl.isBoss?event.color:'var(--border)'}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:12, opacity:locked?0.5:1 }}>
                    <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:done?'var(--accent3)':current?event.color:'var(--muted)', minWidth:32, textAlign:'center' }}>
                      {done ? '✓' : lvl.level}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:16, color:lvl.isBoss?event.color:done?'var(--accent3)':'var(--text)' }}>
                        {lvl.isBoss && '☠ '}{lvl.name}
                        {current && <span style={{ fontSize:9, color:event.color, marginLeft:8, border:`1px solid ${event.color}`, padding:'1px 5px' }}>CURRENT</span>}
                      </div>
                      <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{lvl.format} · {lvl.desc}</div>
                    </div>
                    {done && <div style={{ fontSize:9, color:'var(--accent3)' }}>CLEARED</div>}
                  </div>
                )
              })}
            </div>

            {/* Action buttons */}
            <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
              {prog.dungeonLevel === 0 ? (
                <button className="btn btn-primary" style={{ fontSize:16 }} onClick={() => setScreen('dungeon')}>
                  ⚔ ENTER DUNGEON
                </button>
              ) : (
                <>
                  <button className="btn btn-primary" style={{ fontSize:16 }} onClick={() => setScreen('dungeon')}>
                    ⚔ CONTINUE (Level {prog.dungeonLevel})
                  </button>
                  <button className="btn btn-secondary" style={{ fontSize:12 }} onClick={async () => { if (!authUser) return; const { resetDungeon } = await import('@lib/MythicalEventManager'); await resetDungeon(authUser.id); refresh() }}>
                    RESET DUNGEON
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── TICKET STORE ── */}
        {tab === 'tickets' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'flex', alignItems:'center', gap:10, background:'var(--panel)', border:'1px solid var(--purple)', padding:'12px 16px' }}>
              <div style={{ fontSize:28 }}>🎫</div>
              <div>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:24, color:'var(--purple)' }}>{prog.tickets} TICKETS</div>
                <div style={{ fontSize:9, color:'var(--muted)' }}>Earn 1 ticket per roulette spin · Tickets never expire</div>
              </div>
            </div>

            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(220px,1fr))', gap:10 }}>
              {TICKET_STORE.map(item => {
                const canBuy   = prog.tickets >= item.cost
                const eventKey = `${event?.id}_${item.id}`
                const bought   = item.oneTime && prog.ticketPurchases[eventKey]
                return (
                  <div key={item.id} style={{ background:'var(--panel)', border:`2px solid ${item.id.includes('mythical')?event.color:'var(--border)'}`, padding:'14px 16px', display:'flex', flexDirection:'column', gap:8, boxShadow:item.id.includes('mythical')?`0 0 12px ${event.color}33`:'none' }}>
                    <div style={{ fontSize:28, textAlign:'center' }}>{item.icon}</div>
                    <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:16, color:item.id.includes('mythical')?event.color:'var(--accent2)', textAlign:'center' }}>{item.name}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', textAlign:'center', lineHeight:1.5 }}>{item.desc}</div>
                    <div style={{ borderTop:'1px solid var(--border)', paddingTop:8, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color:'var(--purple)' }}>🎫 {item.cost}</div>
                      <button className={`btn ${item.id.includes('mythical')?'btn-primary':'btn-secondary'}`} style={{ fontSize:11 }} disabled={!canBuy||!!bought} onClick={() => handleTicketBuy(item.id)}>
                        {bought ? 'PURCHASED' : canBuy ? 'BUY' : `NEED ${item.cost - prog.tickets} MORE`}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── SPIN PACKS ── */}
        {tab === 'packs' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ fontSize:10, color:'var(--muted)', lineHeight:1.6 }}>
              Spin packs give paid spins that don't count toward your daily 10-spin limit. Every spin still earns tickets.
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill,minmax(240px,1fr))', gap:12 }}>
              {SPIN_PACKS.map(pack => (
                <div key={pack.id} style={{ background:'var(--panel)', border:`2px solid ${pack.featured?event.color:'var(--border)'}`, padding:'16px 18px', display:'flex', flexDirection:'column', gap:8, position:'relative', boxShadow:pack.featured?`0 0 16px ${event.color}33`:'none' }}>
                  {pack.featured && <div style={{ position:'absolute', top:-10, left:'50%', transform:'translateX(-50%)', background:event.color, color:'#000', fontSize:8, padding:'2px 10px', fontFamily:"'Bebas Neue', sans-serif", letterSpacing:'0.1em', whiteSpace:'nowrap' }}>BEST VALUE</div>}
                  <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:20, color:pack.featured?event.color:'var(--accent2)' }}>{pack.name}</div>

                  {/* Main rewards */}
                  <div style={{ display:'flex', flexDirection:'column', gap:4 }}>
                    <div style={{ fontSize:10, color:'var(--text)' }}>🎰 <strong style={{ color:'var(--accent2)' }}>{pack.spins}</strong> spins</div>
                    <div style={{ fontSize:10, color:'var(--text)' }}>🎫 <strong style={{ color:'var(--purple)' }}>{pack.tickets}</strong> tickets</div>
                    <div style={{ fontSize:10, color:'var(--text)' }}>🪙 <strong style={{ color:'var(--accent2)' }}>{pack.coins.toLocaleString()}</strong> coins</div>
                    {pack.diamonds > 0 && <div style={{ fontSize:10, color:'var(--text)' }}>💎 <strong style={{ color:'var(--purple)' }}>{pack.diamonds}</strong> diamonds</div>}
                    {pack.tokens.map((t,i) => <div key={i} style={{ fontSize:10, color:'var(--text)' }}>{t.icon} ×{t.amount}</div>)}
                    {pack.extras.map((e,i) => <div key={i} style={{ fontSize:9, color:'var(--accent3)' }}>✓ {e}</div>)}
                  </div>

                  <div style={{ borderTop:'1px solid var(--border)', paddingTop:10, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                    <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:'var(--accent2)' }}>{pack.price}</div>
                    <button className={`btn ${pack.featured?'btn-primary':'btn-gold'}`} style={{ fontSize:12 }} onClick={async () => {
                      if (!authUser) { window.alert('Sign in to purchase spin packs.'); return }
                      try {
                        const res = await fetch('/api/buy-spin-pack', { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ packId: pack.id, userId: authUser.id, userEmail: authUser.email }) })
                        const data = await res.json()
                        if (data.url) window.location.href = data.url
                        else window.alert(data.error ?? 'Purchase failed')
                      } catch { window.alert('Network error — try again.') }
                    }}>
                      BUY
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ fontSize:8, color:'var(--muted)', textAlign:'center', lineHeight:1.6 }}>
              Spin pack purchases processed securely via Stripe. Spins are added to your account instantly. All sales final.
            </div>
          </div>
        )}
      </div>
    </div>
  )
}