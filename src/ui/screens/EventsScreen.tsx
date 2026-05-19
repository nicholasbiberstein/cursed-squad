import React, { useState, useEffect, useRef } from 'react'
import { useStore } from '@store'
import {
  loadEventState, claimDailyLogin, canClaimLogin,
  getCompletedQuestCount, claimQuestMilestone,
  spinCommonWheel, spinRareWheel, startMission, skipMission,
  claimMissionReward, isMissionComplete, getMissionTimeLeft,
  getEventState,
} from '@lib/EventManager'
import {
  QUEST_MILESTONES, COMMON_WHEEL, RARE_WHEEL, TIER_COLORS,
  getLoginReward, MISSION_POOL, type WheelSlot, type MissionDef,
} from '@data/events'
import { save } from '@systems/SaveManager'
import { ALL_POWERS } from '@data/powers'

type Tab = 'login' | 'quests' | 'wheel' | 'missions'

// ── SVG Wheel ─────────────────────────────────────────────────
function SpinWheel({ slots, angle }: { slots: WheelSlot[]; angle: number }) {
  const size    = 260
  const cx      = size / 2
  const cy      = size / 2
  const r       = cx - 10
  const total   = slots.reduce((s, sl) => s + sl.weight, 0)
  let   current = -90  // start at top

  const wedges = slots.map((slot, i) => {
    const deg   = (slot.weight / total) * 360
    const start = current
    const end   = current + deg
    current     = end

    const startRad = (start * Math.PI) / 180
    const endRad   = (end   * Math.PI) / 180
    const x1 = cx + r * Math.cos(startRad)
    const y1 = cy + r * Math.sin(startRad)
    const x2 = cx + r * Math.cos(endRad)
    const y2 = cy + r * Math.sin(endRad)
    const large = deg > 180 ? 1 : 0

    const midRad  = ((start + deg / 2) * Math.PI) / 180
    const iconR   = r * 0.65
    const ix      = cx + iconR * Math.cos(midRad)
    const iy      = cy + iconR * Math.sin(midRad)

    const colors = ['#1a1a2e','#16213e','#0f3460','#1a1a2e','#16213e','#0f3460','#1a1a2e']
    return { path: `M ${cx} ${cy} L ${x1} ${y1} A ${r} ${r} 0 ${large} 1 ${x2} ${y2} Z`, ix, iy, icon: slot.icon, color: slot.special ? '#2a1a00' : colors[i % colors.length], stroke: slot.special ? '#ffb800' : slot.color }
  })

  return (
    <div style={{ position: 'relative', width: size, height: size + 20 }}>
      {/* Pointer */}
      <div style={{ position: 'absolute', top: 0, left: '50%', transform: 'translateX(-50%)', fontSize: 22, zIndex: 10, filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.8))' }}>▼</div>
      <div style={{ marginTop: 16 }}>
        <svg width={size} height={size} style={{ transform: `rotate(${angle}deg)`, transition: 'transform 3s cubic-bezier(0.17,0.67,0.12,0.99)', display: 'block' }}>
          {wedges.map((w, i) => (
            <g key={i}>
              <path d={w.path} fill={w.color} stroke={w.stroke} strokeWidth={2} />
              <text x={w.ix} y={w.iy} textAnchor="middle" dominantBaseline="middle" fontSize={18}>{w.icon}</text>
            </g>
          ))}
          <circle cx={cx} cy={cy} r={18} fill="#07070d" stroke="var(--accent2)" strokeWidth={3} />
        </svg>
      </div>
    </div>
  )
}

// ── Mission Unit Picker ───────────────────────────────────────
function MissionPicker({ def, forged, onSend, onCancel }: {
  def: MissionDef
  forged: any[]
  onSend: (powerId: string[]) => void
  onCancel: () => void
}) {
  const [selected, setSelected] = useState<string[]>([])

  // Filter forged cards that meet min rarity
  const RARITY_ORDER = ['common','rare','epic','legendary','mythical']
  const minIdx = RARITY_ORDER.indexOf(def.minRarity)
  const eligible = forged.filter(f => {
    const power = ALL_POWERS.find(p => p.id === f.powerId)
    if (!power) return false
    return RARITY_ORDER.indexOf(power.rarity) >= minIdx
  })

  function toggle(powerId: string) {
    if (selected.includes(powerId)) {
      setSelected(s => s.filter(id => id !== powerId))
    } else if (selected.length < def.slots) {
      setSelected(s => [...s, powerId])
    }
  }

  const tc = TIER_COLORS[def.tier]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.9)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 500, padding: 20, overflowY: 'auto', pointerEvents: 'all' }}>
      <div style={{ maxWidth: 500, width: '100%', display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Mission info */}
        <div style={{ background: 'var(--panel)', border: `2px solid ${tc}`, padding: '14px 18px' }}>
          <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 22, color: tc }}>{def.icon} {def.name}</div>
          <div style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, lineHeight: 1.5 }}>{def.desc}</div>
          <div style={{ display: 'flex', gap: 12, fontSize: 9, color: 'var(--muted)', marginTop: 8 }}>
            <span>👥 {def.slots} unit{def.slots > 1 ? 's' : ''} required</span>
            <span>Minimum rarity: <span style={{ color: tc, textTransform: 'capitalize' }}>{def.minRarity}</span></span>
          </div>
          <div style={{ fontSize: 9, color: 'var(--accent3)', marginTop: 4 }}>
            Reward: 🪙{def.reward.coins}
            {def.reward.diamonds      && ` + 💎${def.reward.diamonds}`}
            {def.reward.common_tokens && ` + 📦 Token`}
            {def.reward.rare_tokens   && ` + 🎁 Token`}
          </div>
        </div>

        <div style={{ fontSize: 10, color: 'var(--accent2)' }}>
          Select {def.slots} unit{def.slots > 1 ? 's' : ''} to send ({selected.length}/{def.slots} selected)
          <span style={{ fontSize: 9, color: 'var(--muted)', marginLeft: 8 }}>Units can still be used in battles while on missions</span>
        </div>

        {eligible.length === 0 && (
          <div style={{ fontSize: 10, color: 'var(--accent)', textAlign: 'center', padding: 16 }}>
            No eligible cards — need at least {def.minRarity} rarity cards for this mission.
          </div>
        )}

        {/* Card grid */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px,1fr))', gap: 8, maxHeight: 340, overflowY: 'auto' }}>
          {eligible.map(f => {
            const power   = ALL_POWERS.find(p => p.id === f.powerId)
            if (!power) return null
            const isSel   = selected.includes(f.powerId)
            return (
              <div key={f.powerId} onClick={() => toggle(f.powerId)} style={{ background: isSel ? 'rgba(60,255,180,0.08)' : 'var(--panel)', border: `2px solid ${isSel ? 'var(--accent3)' : 'var(--border)'}`, padding: '10px 12px', cursor: 'pointer', textAlign: 'center', transition: 'all 0.12s' }}>
                <div style={{ fontSize: 24 }}>{power.icon}</div>
                <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 11, color: 'var(--accent2)', marginTop: 4 }}>{power.name}</div>
                <div style={{ fontSize: 7, color: 'var(--muted)', textTransform: 'capitalize' }}>{power.rarity}</div>
                {f.level && f.level > 1 && <div style={{ fontSize: 7, color: 'var(--accent3)' }}>LV {f.level}</div>}
                {isSel && <div style={{ fontSize: 8, color: 'var(--accent3)', marginTop: 4 }}>✓ SELECTED</div>}
              </div>
            )
          })}
        </div>

        <div style={{ display: 'flex', gap: 10 }}>
          <button className="btn btn-confirm" disabled={selected.length < def.slots} style={{ fontSize: 14 }} onClick={() => onSend(selected)}>
            SEND ON MISSION →
          </button>
          <button className="btn btn-secondary" style={{ fontSize: 12 }} onClick={onCancel}>CANCEL</button>
        </div>
      </div>
    </div>
  )
}

// ── MAIN EVENTS SCREEN ────────────────────────────────────────
export default function EventsScreen() {
  const { setScreen, authUser, coins, diamonds, forged } = useStore()
  const [tab,         setTab]         = useState<Tab>('login')
  const [loaded,      setLoaded]      = useState(false)
  const [eventState,  setEventState]  = useState(getEventState())
  const [loginResult, setLoginResult] = useState<{ reward: any; newStreak: number } | null>(null)
  const [spinResult,  setSpinResult]  = useState<WheelSlot | null>(null)
  const [spinning,    setSpinning]    = useState(false)
  const [wheelAngle,  setWheelAngle]  = useState(0)
  const [activeWheel, setActiveWheel] = useState<'common'|'rare'>('common')
  const [msg,         setMsg]         = useState<string | null>(null)
  const [pickingMission, setPickingMission] = useState<MissionDef | null>(null)
  const timerRef = useRef<number | null>(null)

  useEffect(() => {
    if (!authUser) return
    loadEventState(authUser.id).then(s => { setEventState({ ...s }); setLoaded(true) })
    setTimeout(async () => {
      if (canClaimLogin()) {
        const result = await claimDailyLogin(authUser.id)
        if (result) { setLoginResult(result); setEventState({ ...getEventState() }) }
      }
    }, 600)
    timerRef.current = window.setInterval(() => setEventState({ ...getEventState() }), 30000)
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [authUser])

  function refresh() { setEventState({ ...getEventState() }) }
  function notify(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2400) }

  async function handleSpin(type: 'common'|'rare') {
    if (!authUser || spinning) return
    setSpinning(true); setSpinResult(null)
    const spins  = 5 + Math.random() * 3
    const target = spins * 360 + Math.random() * 360
    setWheelAngle(prev => prev + target)
    setTimeout(async () => {
      const slot = type === 'common' ? await spinCommonWheel(authUser.id) : await spinRareWheel(authUser.id)
      if (!slot) { notify('Not enough tokens!'); setSpinning(false); refresh(); return }
      setSpinResult(slot); setSpinning(false); refresh()
    }, 3200)
  }

  async function handleSendMission(def: MissionDef, powerIds: string[]) {
    if (!authUser) return
    setPickingMission(null)
    const ok = await startMission(authUser.id, def.id, powerIds)
    if (ok) { notify('Mission started! Units are deployed.'); refresh() }
    else    notify('Cannot start — check mission slots.')
  }

  async function handleSkipMission(idx: number) {
    if (!authUser) return
    const ok = await skipMission(authUser.id, idx)
    if (ok) { notify('Mission complete! Reward claimed.'); refresh() }
    else notify('Not enough 💎 diamonds.')
  }

  async function handleClaimMission(idx: number) {
    if (!authUser) return
    const ok = await claimMissionReward(authUser.id, idx)
    if (ok) { notify('Reward claimed!'); refresh() }
  }

  async function handleClaimMilestone(idx: number) {
    if (!authUser) return
    const ok = await claimQuestMilestone(authUser.id, idx)
    if (ok) { notify('Milestone reward claimed!'); refresh() }
    else notify('Already claimed or not enough quests done.')
  }

  if (!authUser) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', height:'100vh', gap:16, background:'var(--bg)', pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:28, color:'var(--accent2)' }}>🎯 EVENTS</div>
      <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', maxWidth:320, lineHeight:1.7 }}>Sign in to access daily rewards, quests, missions and wheel spins.</div>
      <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
    </div>
  )

  const completedCount = getCompletedQuestCount()
  const slots = activeWheel === 'common' ? COMMON_WHEEL : RARE_WHEEL

  return (
    <div style={{ display:'flex', flexDirection:'column', height:'100vh', background:'var(--bg)', overflowY:'auto', pointerEvents:'all' }}>

      {/* Mission picker overlay */}
      {pickingMission && (
        <MissionPicker
          def={pickingMission}
          forged={forged}
          onSend={ids => handleSendMission(pickingMission, ids)}
          onCancel={() => setPickingMission(null)}
        />
      )}

      {/* Header */}
      <div style={{ background:'var(--panel)', borderBottom:'1px solid var(--border)', padding:'10px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:8, flexShrink:0 }}>
        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:26, color:'var(--accent2)' }}>🎯 EVENTS</div>
        <div style={{ display:'flex', gap:10, alignItems:'center' }}>
          <div style={{ fontSize:11, color:'var(--accent2)', fontFamily:"'Bebas Neue', sans-serif" }}>
            🪙 {coins} · 💎 {diamonds} · 📦 {eventState.commonTokens} · 🎁 {eventState.rareTokens}
          </div>
          <button className="btn btn-secondary" style={{ fontSize:10 }} onClick={() => setScreen('title')}>← BACK</button>
        </div>
      </div>

      {/* Toast */}
      {msg && <div style={{ position:'fixed', top:60, left:'50%', transform:'translateX(-50%)', background:'var(--panel)', border:'1px solid var(--accent3)', color:'var(--accent3)', padding:'8px 20px', fontSize:11, fontFamily:"'Bebas Neue', sans-serif", letterSpacing:'0.1em', zIndex:1000, whiteSpace:'nowrap' }}>{msg}</div>}

      {/* Login popup */}
      {loginResult && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.88)', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:16, zIndex:500, pointerEvents:'all' }}>
          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:36, color:'var(--accent2)' }}>📅 DAILY LOGIN!</div>
          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color:'var(--muted)', letterSpacing:'0.1em' }}>DAY {loginResult.newStreak} STREAK</div>
          <div style={{ background:'var(--panel)', border:`2px solid ${loginResult.reward.special?'var(--accent2)':'var(--border)'}`, padding:'24px 40px', textAlign:'center', boxShadow:loginResult.reward.special?'0 0 24px rgba(255,184,0,0.3)':'none' }}>
            <div style={{ fontSize:52 }}>{loginResult.reward.icon}</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:26, color:'var(--accent2)', marginTop:8 }}>{loginResult.reward.label}</div>
          </div>
          <button className="btn btn-primary" style={{ fontSize:18 }} onClick={() => setLoginResult(null)}>CLAIM ✓</button>
        </div>
      )}

      {/* Tabs */}
      <div style={{ display:'flex', borderBottom:'1px solid var(--border)', background:'var(--panel)', flexShrink:0 }}>
        {(['login','quests','wheel','missions'] as const).map(t => (
          <div key={t} onClick={() => setTab(t)} style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:12, letterSpacing:'0.08em', padding:'10px 14px', cursor:'pointer', borderBottom:`2px solid ${tab===t?'var(--accent2)':'transparent'}`, color:tab===t?'var(--accent2)':'var(--muted)', transition:'all 0.12s', whiteSpace:'nowrap' }}>
            {t === 'login' ? '📅 LOGIN' : t === 'quests' ? '✅ QUESTS' : t === 'wheel' ? '🎡 WHEEL' : '🗺 MISSIONS'}
          </div>
        ))}
      </div>

      <div style={{ flex:1, padding:'16px 18px', maxWidth:860, margin:'0 auto', width:'100%' }}>

        {/* ── LOGIN STREAK ── */}
        {tab === 'login' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            <div style={{ display:'flex', alignItems:'center', gap:14, background:'var(--panel)', border:'1px solid var(--border)', padding:'14px 18px' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:48, color:'var(--accent2)', lineHeight:1 }}>{eventState.loginStreak}</div>
              <div>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color:'var(--accent2)' }}>DAY STREAK</div>
                <div style={{ fontSize:9, color:'var(--muted)' }}>Longest: {eventState.longestStreak} days · {canClaimLogin() ? '⏳ Come back tomorrow' : '✓ Claimed today'}</div>
              </div>
            </div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:6 }}>
              {Array.from({ length:30 }, (_, i) => {
                const day    = i + 1
                const reward = getLoginReward(day)
                const claimed = day <= eventState.loginStreak
                const isToday = day === eventState.loginStreak + 1
                return (
                  <div key={day} style={{ background:claimed?'rgba(60,255,180,0.08)':isToday?'rgba(255,184,0,0.08)':'var(--panel)', border:`1px solid ${claimed?'rgba(60,255,180,0.3)':isToday?'var(--accent2)':'var(--border)'}`, padding:'8px 4px', textAlign:'center', boxShadow:isToday?'0 0 8px rgba(255,184,0,0.2)':'none' }}>
                    <div style={{ fontSize:6, color:'var(--muted)', marginBottom:2 }}>DAY {day}</div>
                    <div style={{ fontSize:reward.special?18:14 }}>{claimed?'✓':reward.icon}</div>
                    <div style={{ fontSize:6, color:claimed?'var(--accent3)':reward.special?'var(--accent2)':'var(--muted)', lineHeight:1.3, marginTop:2 }}>
                      {reward.label.split('+')[0].trim()}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── QUESTS ── */}
        {tab === 'quests' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'12px 16px' }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, color:'var(--accent2)', marginBottom:10 }}>DAILY PROGRESS — {completedCount}/6</div>
              <div style={{ display:'flex', gap:0, position:'relative', alignItems:'center', paddingBottom:28 }}>
                <div style={{ position:'absolute', top:16, left:0, right:0, height:2, background:'var(--border)' }} />
                <div style={{ position:'absolute', top:16, left:0, height:2, background:'var(--accent3)', width:`${(completedCount/6)*100}%`, transition:'width 0.4s' }} />
                {QUEST_MILESTONES.map((m, i) => {
                  const reached = completedCount >= m.required
                  const claimed = eventState.questsClaimed?.includes(i)
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', position:'relative', zIndex:1 }}>
                      <button onClick={() => handleClaimMilestone(i)} disabled={!reached||claimed} style={{ width:32, height:32, borderRadius:'50%', fontSize:14, background:claimed?'var(--accent3)':reached?'var(--accent2)':'var(--border)', border:'none', cursor:reached&&!claimed?'pointer':'default', display:'flex', alignItems:'center', justifyContent:'center' }}>
                        {claimed?'✓':m.reward.icon}
                      </button>
                      <div style={{ fontSize:7, color:'var(--muted)', marginTop:4, textAlign:'center', position:'absolute', top:36 }}>{m.required}/6</div>
                    </div>
                  )
                })}
              </div>
            </div>

            {!loaded && <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', padding:20 }}>Loading quests...</div>}

            {loaded && eventState.quests?.length === 0 && (
              <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center', padding:20 }}>No quests available — try refreshing.</div>
            )}

            {eventState.quests?.map((quest: any) => {
              const prog = eventState.questProgress?.find((p: any) => p.questId === quest.id) ?? { progress:0, done:false }
              const pct  = Math.min(100, (prog.progress / quest.target) * 100)
              return (
                <div key={quest.id} style={{ background:'var(--panel)', border:`1px solid ${prog.done?'rgba(60,255,180,0.3)':'var(--border)'}`, padding:'12px 16px', display:'flex', alignItems:'center', gap:12 }}>
                  <div style={{ fontSize:22, flexShrink:0 }}>{quest.icon}</div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, color:prog.done?'var(--accent3)':'var(--text)' }}>{quest.label}</div>
                    <div style={{ fontSize:9, color:'var(--muted)', marginBottom:4 }}>{quest.desc}</div>
                    <div style={{ background:'var(--panel2)', height:4, borderRadius:2, overflow:'hidden' }}>
                      <div style={{ height:'100%', background:prog.done?'var(--accent3)':'var(--accent2)', width:`${pct}%`, transition:'width 0.3s' }} />
                    </div>
                    <div style={{ fontSize:8, color:'var(--muted)', marginTop:2 }}>{prog.progress}/{quest.target}</div>
                  </div>
                  {prog.done && <div style={{ fontSize:10, color:'var(--accent3)', fontFamily:"'Bebas Neue', sans-serif", border:'1px solid var(--accent3)', padding:'2px 8px', whiteSpace:'nowrap' }}>DONE ✓</div>}
                </div>
              )
            })}
          </div>
        )}

        {/* ── WHEEL ── */}
        {tab === 'wheel' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center' }}>
            <div style={{ display:'flex', gap:8 }}>
              {(['common','rare'] as const).map(w => (
                <button key={w} onClick={() => { setActiveWheel(w); setSpinResult(null) }} className={`btn ${activeWheel===w?'btn-primary':'btn-secondary'}`} style={{ fontSize:12 }}>
                  {w==='common'?'📦 COMMON':'🎁 RARE'} WHEEL
                </button>
              ))}
            </div>

            <div style={{ fontSize:11, color:'var(--muted)' }}>
              {activeWheel==='common' ? `📦 Common Tokens: ${eventState.commonTokens}` : `🎁 Rare Tokens: ${eventState.rareTokens}`}
            </div>

            <SpinWheel slots={slots} angle={wheelAngle} />

            {spinResult && (
              <div style={{ background:'var(--panel)', border:`2px solid ${spinResult.special?'var(--accent2)':'var(--border)'}`, padding:'16px 28px', textAlign:'center', boxShadow:spinResult.special?'0 0 20px rgba(255,184,0,0.3)':'none', minWidth:200 }}>
                <div style={{ fontSize:36 }}>{spinResult.icon}</div>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:22, color:spinResult.special?'var(--accent2)':'var(--text)', marginTop:6 }}>{spinResult.label}</div>
                {spinResult.special && <div style={{ fontSize:9, color:'var(--accent2)', marginTop:4, letterSpacing:'0.12em' }}>★ LUCKY SPIN!</div>}
              </div>
            )}

            <button className="btn btn-gold" style={{ fontSize:18, padding:'12px 36px' }} disabled={spinning||(activeWheel==='common'?eventState.commonTokens<1:eventState.rareTokens<1)} onClick={() => handleSpin(activeWheel)}>
              {spinning ? '🎡 SPINNING...' : `🎡 SPIN (1 ${activeWheel==='common'?'📦':'🎁'} Token)`}
            </button>

            <div style={{ background:'var(--panel)', border:'1px solid var(--border)', padding:'12px 16px', width:'100%', maxWidth:360 }}>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:12, color:'var(--muted)', letterSpacing:'0.12em', marginBottom:8 }}>ODDS</div>
              {slots.map(slot => (
                <div key={slot.label} style={{ display:'flex', justifyContent:'space-between', fontSize:9, color:'var(--muted)', marginBottom:3 }}>
                  <span>{slot.icon} {slot.label}</span>
                  <span style={{ color:slot.special?'var(--accent2)':'var(--muted)' }}>{slot.weight}%</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── MISSIONS ── */}
        {tab === 'missions' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>

            {/* Active missions */}
            {eventState.missions?.filter((m: any) => !m.completed).length > 0 && (
              <div>
                <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, color:'var(--accent2)', letterSpacing:'0.1em', marginBottom:8 }}>ACTIVE MISSIONS ({eventState.missions.filter((m:any)=>!m.completed).length}/{eventState.missionSlots})</div>
                {eventState.missions?.map((mission: any, i: number) => {
                  if (mission.completed) return null
                  const def      = MISSION_POOL.find(m => m.id === mission.defId)
                  if (!def) return null
                  const done     = isMissionComplete(mission)
                  const timeLeft = getMissionTimeLeft(mission)
                  const tc       = TIER_COLORS[def.tier]
                  return (
                    <div key={i} style={{ background:'var(--panel)', border:`1px solid ${done?'var(--accent3)':tc}`, padding:'12px 16px', display:'flex', alignItems:'center', justifyContent:'space-between', gap:10, marginBottom:8 }}>
                      <div>
                        <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:16, color:tc }}>{def.icon} {def.name}</div>
                        <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{done?'✓ Ready to claim!': `⏱ ${timeLeft} remaining`}</div>
                        <div style={{ fontSize:9, color:'var(--accent3)', marginTop:2 }}>
                          Reward: 🪙{def.reward.coins}{def.reward.diamonds&&` + 💎${def.reward.diamonds}`}{def.reward.common_tokens&&` + 📦`}{def.reward.rare_tokens&&` + 🎁`}
                        </div>
                      </div>
                      {done ? (
                        <button className="btn btn-confirm" style={{ fontSize:11 }} onClick={() => handleClaimMission(i)}>CLAIM</button>
                      ) : (
                        <button className="btn btn-purple" style={{ fontSize:11 }} onClick={() => handleSkipMission(i)}>💎{def.skipCost} SKIP</button>
                      )}
                    </div>
                  )
                })}
              </div>
            )}

            {/* Available missions */}
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:14, color:'var(--accent2)', letterSpacing:'0.1em' }}>AVAILABLE MISSIONS</div>
            <div style={{ fontSize:9, color:'var(--muted)' }}>
              Slots used: {eventState.missions?.filter((m:any)=>!m.completed).length ?? 0}/{eventState.missionSlots} · Units on missions can still fight in battles
            </div>

            {eventState.availableMissions?.map((def: MissionDef) => {
              const tc           = TIER_COLORS[def.tier]
              const durationStr  = def.duration < 60 ? `${def.duration}m` : def.duration < 1440 ? `${def.duration/60}h` : '24h'
              const slotsUsed    = eventState.missions?.filter((m:any)=>!m.completed).length ?? 0
              const canSend      = slotsUsed < eventState.missionSlots
              return (
                <div key={def.id} style={{ background:'var(--panel)', border:`2px solid ${tc}`, padding:'14px 16px', display:'flex', flexDirection:'column', gap:8 }}>
                  <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start' }}>
                    <div>
                      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:18, color:tc }}>{def.icon} {def.name}</div>
                      <div style={{ fontSize:9, color:'var(--muted)', marginTop:2 }}>{def.desc}</div>
                    </div>
                    <div style={{ fontSize:8, color:tc, border:`1px solid ${tc}`, padding:'2px 8px', fontFamily:"'Bebas Neue', sans-serif", whiteSpace:'nowrap' }}>{def.tier.toUpperCase()}</div>
                  </div>
                  <div style={{ display:'flex', gap:12, fontSize:9, color:'var(--muted)', flexWrap:'wrap' }}>
                    <span>⏱ {durationStr}</span>
                    <span>👥 {def.slots} unit{def.slots>1?'s':''}</span>
                    <span style={{ textTransform:'capitalize' }}>Min rarity: <span style={{ color:tc }}>{def.minRarity}</span></span>
                    <span>💎{def.skipCost} to skip</span>
                  </div>
                  <div style={{ fontSize:9, color:'var(--accent3)' }}>
                    Reward: 🪙{def.reward.coins}
                    {def.reward.diamonds      && ` + 💎${def.reward.diamonds}`}
                    {def.reward.common_tokens && ` + 📦 Token`}
                    {def.reward.rare_tokens   && ` + 🎁 Token`}
                  </div>
                  <button className="btn btn-secondary" style={{ fontSize:11, alignSelf:'flex-start' }} disabled={!canSend} onClick={() => setPickingMission(def)}>
                    {canSend ? 'SELECT UNITS & SEND →' : 'MISSION SLOTS FULL'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}