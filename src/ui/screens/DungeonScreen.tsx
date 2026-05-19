import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import {
  getMythicalProgress, completeDungeonLevel,
  applyDungeonPowerup, completeDungeon, startDungeon, resetDungeon,
} from '@lib/MythicalEventManager'
import { getActiveEvent, DUNGEON_LEVELS, DUNGEON_POWERUPS, type DungeonLevel, type DungeonPowerup } from '@data/mythicalEvents'
import { ALL_POWERS } from '@data/powers'
import { ALL_CURSES } from '@data/curses'
import { save } from '@systems/SaveManager'
import { rarColor } from '@data/rarity'

// ============================================================
// DUNGEON SCREEN
// Manages dungeon state: squad selection, level battles,
// powerup picks between levels, boss fight, completion.
// Uses existing BattleHUD system for actual combat.
// ============================================================

type DungeonPhase = 'select_squad' | 'pre_level' | 'in_battle' | 'powerup_pick' | 'victory' | 'defeat'

interface DungeonUnit {
  id:       string
  name:     string
  icon:     string
  hp:       number
  maxHp:    number
  powerId:  string
  curseId:  string
  alive:    boolean
}

export default function DungeonScreen() {
  const { setScreen, authUser, forged, buildSlots } = useStore()
  const event = getActiveEvent()
  const prog  = getMythicalProgress()

  const [phase,         setPhase]         = useState<DungeonPhase>('select_squad')
  const [squad,         setSquad]         = useState<DungeonUnit[]>([])
  const [currentLevel,  setCurrentLevel]  = useState(prog.dungeonLevel > 0 ? prog.dungeonLevel : 1)
  const [selectedPowerup, setSelectedPowerup] = useState<DungeonPowerup | null>(null)
  const [powerupTarget, setPowerupTarget] = useState<string | null>(null)
  const [powerupOptions, setPowerupOptions] = useState<DungeonPowerup[]>([])
  const [msg,           setMsg]           = useState<string | null>(null)

  useEffect(() => {
    // If dungeon already in progress, restore squad from saved state
    if (prog.dungeonLevel > 0 && prog.dungeonUnits.length > 0) {
      const restored = prog.dungeonUnits.map((u: any) => ({
        ...u,
        hp:    prog.dungeonHp[u.id] ?? u.maxHp,
        alive: (prog.dungeonHp[u.id] ?? u.maxHp) > 0,
      }))
      setSquad(restored)
      setCurrentLevel(prog.dungeonLevel)
      setPhase('pre_level')
    }
  }, [])

  function notify(m: string) { setMsg(m); setTimeout(() => setMsg(null), 2500) }

  const levelDef = DUNGEON_LEVELS.find(l => l.level === currentLevel) ?? DUNGEON_LEVELS[0]

  // ── SQUAD SELECTION ───────────────────────────────────────
  function handleStartDungeon() {
    if (!authUser) return
    // Use current build slots as squad
    const units: DungeonUnit[] = buildSlots
      .filter(Boolean)
      .slice(0, 5)
      .map((slot: any, i) => ({
        id:      `dungeon_unit_${i}`,
        name:    `UNIT ${i + 1}`,
        icon:    slot.icon ?? '🧍',
        hp:      100,
        maxHp:   100,
        powerId: slot.power?.id ?? slot.powerId ?? '',
        curseId: slot.downside?.id ?? slot.curseId ?? '',
        alive:   true,
      }))

    if (units.length < 2) { notify('Build a squad of at least 2 units first!'); return }

    setSquad(units)
    startDungeon(authUser.id, units)
    setCurrentLevel(1)
    setPhase('pre_level')
  }

  // ── ENTER BATTLE ─────────────────────────────────────────
  function handleEnterBattle() {
    // Set up the battle using the existing battle system
    // Pass dungeon-specific units and enemy config to battle
    const aliveUnits = squad.filter(u => u.alive)
    if (aliveUnits.length === 0) { setPhase('defeat'); return }

    // Store dungeon context in game store so BattleHUD knows we're in dungeon mode
    useStore.setState({
      mode:      'dungeon' as any,
      campWave:  currentLevel - 1,
      campUnits: aliveUnits.map(u => ({
        id:        u.id,
        name:      u.name,
        icon:      u.icon,
        team:      'player',
        hp:        u.hp,
        maxHp:     u.maxHp,
        speed:     10,
        vision:    5,
        statuses:  {},
        turnCount: 0,
        pendingAbility: null,
        pos:       { r: 0, c: 0 },
        power:     ALL_POWERS.find(p => p.id === u.powerId) ?? ALL_POWERS[0],
        downside:  ALL_CURSES.find(c => c.id === u.curseId) ?? ALL_CURSES[0],
        personality: 'aggressive' as any,
      }))
    })
    setPhase('in_battle')
    setScreen('battle')
  }

  // Called when battle ends — check store for result
  useEffect(() => {
    const unsub = useStore.subscribe(state => {
      if ((state as any).screen === 'dungeon' && phase === 'in_battle') {
        // Battle returned to dungeon — check result
        handleBattleResult()
      }
    })
    return unsub
  }, [phase, currentLevel, squad])

  function handleBattleResult() {
    // Get surviving units from the battle
    const battleUnits = useStore.getState().units
    const survivors = battleUnits.filter(u => u.team === 'player' && u.hp > 0)

    if (survivors.length === 0) {
      // All defeated — restart current level
      setPhase('defeat')
      return
    }

    // Update squad HP from battle results
    const updatedSquad = squad.map(u => {
      const battleUnit = survivors.find(b => b.id === u.id)
      return { ...u, hp: battleUnit?.hp ?? 0, alive: !!battleUnit }
    })
    setSquad(updatedSquad)

    if (currentLevel >= 5) {
      // Beat the boss — dungeon complete!
      handleDungeonComplete(updatedSquad)
    } else {
      // Offer powerup between levels
      const opts = [...DUNGEON_POWERUPS].sort(() => Math.random() - 0.5).slice(0, 3)
      setPowerupOptions(opts)
      setSelectedPowerup(null)
      setPowerupTarget(null)
      setPhase('powerup_pick')
    }
  }

  async function handleSelectPowerup() {
    if (!authUser || !selectedPowerup) return

    // Apply powerup effect
    const updatedSquad = [...squad]
    if (selectedPowerup.id === 'full_heal' && powerupTarget) {
      const idx = updatedSquad.findIndex(u => u.id === powerupTarget)
      if (idx >= 0) updatedSquad[idx] = { ...updatedSquad[idx], hp: updatedSquad[idx].maxHp }
    }
    if (selectedPowerup.id === 'revive' && powerupTarget) {
      const idx = updatedSquad.findIndex(u => u.id === powerupTarget)
      if (idx >= 0) updatedSquad[idx] = { ...updatedSquad[idx], hp: Math.floor(updatedSquad[idx].maxHp * 0.5), alive: true }
    }
    if (selectedPowerup.id === 'power_surge') {
      // Applied in next battle via store flag
      useStore.setState({ dungeonPowerSurgeTarget: powerupTarget } as any)
    }
    if (selectedPowerup.id === 'shield_wall') {
      useStore.setState({ dungeonShieldTarget: powerupTarget } as any)
    }

    await applyDungeonPowerup(authUser.id, selectedPowerup.id)
    setSquad(updatedSquad)

    // Save progress and advance level
    await completeDungeonLevel(authUser.id, updatedSquad, currentLevel)
    setCurrentLevel(prev => prev + 1)
    setPhase('pre_level')
  }

  async function handleDungeonComplete(finalSquad: DungeonUnit[]) {
    if (!authUser) return
    await completeDungeon(authUser.id)
    setPhase('victory')
    // Refresh mythical progress
    const { loadMythicalProgress } = await import('@lib/MythicalEventManager')
    await loadMythicalProgress(authUser.id)
  }

  async function handleDefeatRetry() {
    // Restart at current level (not from beginning)
    const restoredSquad = squad.map(u => ({ ...u, hp: u.alive ? u.hp : 0 }))
    setSquad(restoredSquad)
    setPhase('pre_level')
  }

  if (!event) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)', pointerEvents:'all' }}>
      <button className="btn btn-secondary" onClick={() => setScreen('mythical')}>← BACK</button>
    </div>
  )

  // ── SELECT SQUAD ──────────────────────────────────────────
  if (phase === 'select_squad') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', gap:18, padding:24, pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:36, color:event.color, textAlign:'center' }}>⚔ MYTHICAL DUNGEON</div>
      <div style={{ fontSize:10, color:'var(--muted)', maxWidth:420, textAlign:'center', lineHeight:1.7 }}>
        Your current squad will enter the dungeon. HP carries over between all 5 levels. Choose powerups wisely between levels. Defeat the boss to earn the mythical power.
      </div>

      {/* Squad preview */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {buildSlots.filter(Boolean).slice(0,5).map((slot: any, i) => {
          const power = ALL_POWERS.find(p => p.id === (slot.power?.id ?? slot.powerId))
          return (
            <div key={i} style={{ background:'var(--panel)', border:'2px solid var(--blue)', padding:'10px 14px', textAlign:'center', minWidth:100 }}>
              <div style={{ fontSize:24 }}>{slot.icon ?? '🧍'}</div>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:11, color:'var(--blue)', marginTop:4 }}>UNIT {i+1}</div>
              <div style={{ fontSize:8, color:'var(--muted)' }}>{power?.name ?? 'Unknown'}</div>
              <div style={{ fontSize:8, color:'var(--accent3)', marginTop:2 }}>100 HP</div>
            </div>
          )
        })}
      </div>

      {msg && <div style={{ fontSize:10, color:'var(--accent)', border:'1px solid var(--accent)', padding:'6px 14px' }}>{msg}</div>}

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-primary" style={{ fontSize:18 }} onClick={handleStartDungeon}>⚔ ENTER DUNGEON</button>
        <button className="btn btn-secondary" onClick={() => setScreen('build')}>EDIT SQUAD →</button>
        <button className="btn btn-secondary" onClick={() => setScreen('mythical')}>← BACK</button>
      </div>
    </div>
  )

  // ── PRE-LEVEL ─────────────────────────────────────────────
  if (phase === 'pre_level') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', gap:18, padding:24, pointerEvents:'all' }}>
      <div style={{ fontSize:9, color:event.color, letterSpacing:'0.2em', fontFamily:"'Bebas Neue', sans-serif" }}>DUNGEON — LEVEL {currentLevel} OF 5</div>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:36, color:levelDef.isBoss?event.color:'var(--accent2)', textAlign:'center' }}>
        {levelDef.isBoss && '☠ '}{levelDef.name}
      </div>
      <div style={{ fontSize:10, color:'var(--muted)', maxWidth:380, textAlign:'center', lineHeight:1.7 }}>{levelDef.desc}</div>
      <div style={{ fontSize:10, color:'var(--accent2)' }}>Format: {levelDef.format} · Enemy tier: {levelDef.enemyTier}</div>

      {/* Squad HP status */}
      <div style={{ display:'flex', gap:8, flexWrap:'wrap', justifyContent:'center' }}>
        {squad.map(u => (
          <div key={u.id} style={{ background:'var(--panel)', border:`2px solid ${u.alive && u.hp > 0 ? 'var(--blue)' : 'var(--border)'}`, padding:'8px 12px', textAlign:'center', minWidth:80, opacity: u.alive && u.hp > 0 ? 1 : 0.3 }}>
            <div style={{ fontSize:20 }}>{u.icon}</div>
            <div style={{ fontSize:7, color:'var(--blue)', fontFamily:"'Bebas Neue', sans-serif" }}>{u.name}</div>
            <div style={{ background:'#0d0d17', height:4, margin:'4px 0' }}>
              <div style={{ height:'100%', background: u.hp > 60 ? 'var(--accent3)' : u.hp > 30 ? 'var(--accent2)' : 'var(--accent)', width:`${Math.max(0,(u.hp/u.maxHp)*100)}%` }} />
            </div>
            <div style={{ fontSize:7, color:'var(--muted)' }}>{u.alive && u.hp > 0 ? `${u.hp}/${u.maxHp}` : '✝ FALLEN'}</div>
          </div>
        ))}
      </div>

      {levelDef.isBoss && (
        <div style={{ background:'rgba(255,60,60,0.08)', border:`2px solid ${event.color}`, padding:'12px 20px', textAlign:'center', maxWidth:380 }}>
          <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:16, color:event.color }}>☠ BOSS BATTLE WARNING</div>
          <div style={{ fontSize:10, color:'var(--muted)', marginTop:4, lineHeight:1.6 }}>
            The boss wields the mythical power. Defeat them to claim it. This is your final challenge.
          </div>
        </div>
      )}

      <button className="btn btn-primary" style={{ fontSize:20, padding:'14px 36px', borderColor:levelDef.isBoss?event.color:undefined, color:levelDef.isBoss?event.color:undefined }} onClick={handleEnterBattle}>
        {levelDef.isBoss ? '☠ FACE THE BOSS' : `⚔ FIGHT LEVEL ${currentLevel}`}
      </button>
      <button className="btn btn-secondary" style={{ fontSize:10 }} onClick={() => setScreen('mythical')}>← SAVE & EXIT</button>
    </div>
  )

  // ── POWERUP PICK ──────────────────────────────────────────
  if (phase === 'powerup_pick') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', gap:16, padding:24, pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:32, color:'var(--accent2)' }}>⚡ CHOOSE A POWERUP</div>
      <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center' }}>Level {currentLevel} cleared! Pick one powerup before the next fight.</div>

      {/* Powerup options */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:12, maxWidth:600, width:'100%' }}>
        {powerupOptions.map(pu => {
          const isSel = selectedPowerup?.id === pu.id
          return (
            <div key={pu.id} onClick={() => { setSelectedPowerup(pu); setPowerupTarget(null) }} style={{ background:isSel?'rgba(60,255,180,0.08)':'var(--panel)', border:`2px solid ${isSel?'var(--accent3)':'var(--border)'}`, padding:16, cursor:'pointer', textAlign:'center', transition:'all 0.12s' }}>
              <div style={{ fontSize:36 }}>{pu.icon}</div>
              <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:16, color:'var(--accent2)', marginTop:8 }}>{pu.name}</div>
              <div style={{ fontSize:9, color:'var(--muted)', marginTop:4, lineHeight:1.5 }}>{pu.desc}</div>
            </div>
          )
        })}
      </div>

      {/* Target selection for heal/revive */}
      {selectedPowerup && ['full_heal','revive','power_surge','shield_wall'].includes(selectedPowerup.id) && (
        <div style={{ width:'100%', maxWidth:500 }}>
          <div style={{ fontSize:9, color:'var(--accent2)', marginBottom:8, textAlign:'center' }}>
            {selectedPowerup.id === 'revive' ? 'Select a fallen unit to revive:' : 'Select a unit to apply to:'}
          </div>
          <div style={{ display:'flex', gap:8, justifyContent:'center', flexWrap:'wrap' }}>
            {squad.filter(u => selectedPowerup.id === 'revive' ? !u.alive || u.hp <= 0 : u.alive && u.hp > 0).map(u => (
              <div key={u.id} onClick={() => setPowerupTarget(u.id)} style={{ background:powerupTarget===u.id?'rgba(60,255,180,0.08)':'var(--panel)', border:`2px solid ${powerupTarget===u.id?'var(--accent3)':'var(--border)'}`, padding:'8px 14px', cursor:'pointer', textAlign:'center', minWidth:80 }}>
                <div style={{ fontSize:20 }}>{u.icon}</div>
                <div style={{ fontSize:8, color:'var(--blue)' }}>{u.name}</div>
                <div style={{ fontSize:7, color:'var(--muted)' }}>{u.hp}/{u.maxHp} HP</div>
              </div>
            ))}
          </div>
        </div>
      )}

      <button
        className="btn btn-confirm"
        style={{ fontSize:16 }}
        disabled={!selectedPowerup || (['full_heal','revive','power_surge','shield_wall'].includes(selectedPowerup.id) && !powerupTarget)}
        onClick={handleSelectPowerup}
      >
        CONFIRM POWERUP →
      </button>
    </div>
  )

  // ── DEFEAT ────────────────────────────────────────────────
  if (phase === 'defeat') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', gap:18, padding:24, pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:52, color:'var(--accent)', filter:'drop-shadow(0 0 20px rgba(255,60,60,0.5))' }}>DEFEATED</div>
      <div style={{ fontSize:11, color:'var(--muted)', textAlign:'center', maxWidth:360, lineHeight:1.7 }}>
        Your squad was eliminated on Level {currentLevel}. Your progress is saved — you'll restart this level, not from the beginning.
      </div>
      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-primary" style={{ fontSize:16 }} onClick={handleDefeatRetry}>↩ RETRY LEVEL {currentLevel}</button>
        <button className="btn btn-secondary" onClick={() => setScreen('mythical')}>← EXIT DUNGEON</button>
      </div>
    </div>
  )

  // ── VICTORY ───────────────────────────────────────────────
  if (phase === 'victory') return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', minHeight:'100vh', background:'var(--bg)', gap:20, padding:24, pointerEvents:'all' }}>
      <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:52, color:event.color, filter:`drop-shadow(0 0 28px ${event.color}88)`, textAlign:'center', lineHeight:1 }}>
        DUNGEON<br />CLEARED!
      </div>

      {/* Mythical power earned */}
      {ALL_POWERS.find(p => p.id === event.powerId) && (() => {
        const power = ALL_POWERS.find(p => p.id === event.powerId)!
        return (
          <div style={{ background:'var(--panel)', border:`2px solid ${event.color}`, padding:'20px 32px', textAlign:'center', boxShadow:`0 0 32px ${event.color}44` }}>
            <div style={{ fontSize:9, color:event.color, letterSpacing:'0.2em', fontFamily:"'Bebas Neue', sans-serif", marginBottom:6 }}>☠ MYTHICAL POWER EARNED</div>
            <div style={{ fontSize:52 }}>{power.icon}</div>
            <div style={{ fontFamily:"'Bebas Neue', sans-serif", fontSize:32, color:'var(--r-mythical)', marginTop:8 }}>{power.name}</div>
            <div style={{ fontSize:10, color:'var(--muted)', marginTop:6, lineHeight:1.6, maxWidth:280 }}>{power.desc}</div>
          </div>
        )
      })()}

      <div style={{ fontSize:10, color:'var(--muted)', textAlign:'center' }}>
        The mythical power has been added to your collection. Bind a curse to forge it.
      </div>

      <div style={{ display:'flex', gap:10 }}>
        <button className="btn btn-primary" style={{ fontSize:16 }} onClick={() => setScreen('collection')}>VIEW COLLECTION →</button>
        <button className="btn btn-secondary" onClick={() => setScreen('mythical')}>← EVENT HUB</button>
      </div>
    </div>
  )

  return null
}