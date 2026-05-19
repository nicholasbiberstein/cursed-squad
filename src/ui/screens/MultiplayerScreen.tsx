import React, { useState, useEffect } from 'react'
import { useStore } from '@store'
import { getRankInfo, TIERS } from '@lib/RankSystem'
import { supabase } from '@lib/supabase'
import { isLoggedIn, getCurrentUser } from '@lib/AuthManager'

// ============================================================
// MULTIPLAYER SCREEN
// Ranked queue, friend challenges, active matches, leaderboard.
// ============================================================

type Tab = 'ranked' | 'challenge' | 'matches' | 'leaderboard'

interface PlayerStats {
  mmr:               number
  wins:              number
  losses:            number
  placement_done:    boolean
  placements_played: number
  rank_tier:         string
}

interface Match {
  id:             string
  player_a:       string
  player_b:       string | null
  status:         string
  is_ranked:      boolean
  challenge_code: string | null
  created_at:     string
  winner:         string | null
  mmr_change_a:   number
  mmr_change_b:   number
}

interface LeaderboardEntry {
  player_id: string
  mmr:       number
  wins:      number
  losses:    number
  rank_tier: string
  username:  string
}

export default function MultiplayerScreen() {
  const { setScreen, buildSlots, authUser } = useStore()
  const [tab,           setTab]           = useState<Tab>('ranked')
  const [stats,         setStats]         = useState<PlayerStats | null>(null)
  const [matches,       setMatches]       = useState<Match[]>([])
  const [leaderboard,   setLeaderboard]   = useState<LeaderboardEntry[]>([])
  const [loading,       setLoading]       = useState(false)
  const [statusMsg,     setStatusMsg]     = useState<string | null>(null)
  const [challengeCode, setChallengeCode] = useState('')
  const [myCode,        setMyCode]        = useState<string | null>(null)
  const [error,         setError]         = useState<string | null>(null)

  useEffect(() => {
    if (!authUser) return
    loadStats()
    loadMatches()
    loadLeaderboard()
  }, [authUser])

  async function loadStats() {
    if (!authUser) return
    const { data } = await supabase
      .from('player_stats')
      .select('*')
      .eq('player_id', authUser.id)
      .single()
    if (data) setStats(data)
    else {
      // Create stats row if missing
      await supabase.from('player_stats').insert({ player_id: authUser.id })
      setStats({ mmr: 0, wins: 0, losses: 0, placement_done: false, placements_played: 0, rank_tier: 'UNRANKED' })
    }
  }

  async function loadMatches() {
    if (!authUser) return
    const { data } = await supabase
      .from('matches')
      .select('*')
      .or(`player_a.eq.${authUser.id},player_b.eq.${authUser.id}`)
      .order('created_at', { ascending: false })
      .limit(20)
    if (data) setMatches(data)
  }

  async function loadLeaderboard() {
    const { data } = await supabase
      .from('player_stats')
      .select('player_id, mmr, wins, losses, rank_tier')
      .eq('placement_done', true)
      .order('mmr', { ascending: false })
      .limit(50)

    if (!data) return

    // Fetch usernames
    const ids = data.map(d => d.player_id)
    const { data: players } = await supabase.from('players').select('id, username').in('id', ids)
    const usernameMap: Record<string, string> = {}
    players?.forEach(p => { usernameMap[p.id] = p.username })

    setLeaderboard(data.map(d => ({ ...d, username: usernameMap[d.player_id] ?? 'Unknown' })))
  }

  async function handleRankedQueue() {
    if (!authUser) return
    const squad = buildSlots.filter(Boolean)
    if (squad.length < 1) { setError('Build your squad first before queuing.'); return }

    setLoading(true); setError(null); setStatusMsg(null)
    try {
      const res = await fetch('/api/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id, squad: buildSlots, isRanked: true }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }

      if (data.status === 'waiting') {
        setStatusMsg('⏳ In queue — waiting for an opponent. Check back in a minute!')
      } else {
        setStatusMsg(`⚔ Match found! Result: ${data.result?.winner === 'a' ? 'YOU WON! 🏆' : 'You lost.'}`)
        await loadStats()
        await loadMatches()
      }
    } catch (err) {
      setError('Network error — please try again.')
    }
    setLoading(false)
  }

  async function handleCreateChallenge() {
    if (!authUser) return
    const squad = buildSlots.filter(Boolean)
    if (squad.length < 1) { setError('Build your squad first.'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id, squad: buildSlots, isRanked: false }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setMyCode(data.challengeCode)
    } catch { setError('Network error.') }
    setLoading(false)
  }

  async function handleJoinChallenge() {
    if (!authUser || !challengeCode.trim()) return
    const squad = buildSlots.filter(Boolean)
    if (squad.length < 1) { setError('Build your squad first.'); return }

    setLoading(true); setError(null)
    try {
      const res = await fetch('/api/create-match', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: authUser.id, squad: buildSlots, isRanked: false, challengeCode: challengeCode.trim().toUpperCase() }),
      })
      const data = await res.json()
      if (data.error) { setError(data.error); setLoading(false); return }
      setStatusMsg(`⚔ Challenge result: ${data.result?.winner === 'b' ? 'YOU WON! 🏆' : 'You lost.'}`)
      await loadMatches()
    } catch { setError('Network error.') }
    setLoading(false)
  }

  const rankInfo = stats ? getRankInfo(stats.mmr, stats.placement_done) : null
  const winRate  = stats && (stats.wins + stats.losses) > 0
    ? Math.round((stats.wins / (stats.wins + stats.losses)) * 100)
    : 0

  if (!authUser) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh', gap: 16, background: 'var(--bg)', pointerEvents: 'all' }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 28, color: 'var(--accent2)' }}>⚔ MULTIPLAYER</div>
        <div style={{ fontSize: 11, color: 'var(--muted)', maxWidth: 340, textAlign: 'center', lineHeight: 1.7 }}>
          You need a free account to access multiplayer. Sign in or create an account from the title screen.
        </div>
        <button className="btn btn-secondary" onClick={() => setScreen('title')}>← BACK</button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', background: 'var(--bg)', overflowY: 'auto', pointerEvents: 'all' }}>

      {/* Header */}
      <div style={{ background: 'var(--panel)', borderBottom: '1px solid var(--border)', padding: '10px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
        <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 26, color: 'var(--accent2)' }}>⚔ MULTIPLAYER</div>

        {/* Rank badge */}
        {rankInfo && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: 'var(--panel2)', border: `1px solid ${rankInfo.color}`, padding: '6px 14px' }}>
            <div style={{ fontSize: 22 }}>{rankInfo.icon}</div>
            <div>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: rankInfo.color }}>{rankInfo.label}</div>
              <div style={{ fontSize: 8, color: 'var(--muted)' }}>{stats?.mmr ?? 0} MMR · {stats?.wins}W {stats?.losses}L · {winRate}% WR</div>
            </div>
            {!stats?.placement_done && (
              <div style={{ fontSize: 8, color: 'var(--accent2)', border: '1px solid var(--accent2)', padding: '2px 6px' }}>
                {5 - (stats?.placements_played ?? 0)} PLACEMENTS LEFT
              </div>
            )}
          </div>
        )}

        <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => setScreen('title')}>← BACK</button>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--panel)' }}>
        {([['ranked','⚔ RANKED'],['challenge','🤝 CHALLENGE'],['matches','📋 MY MATCHES'],['leaderboard','🏆 LEADERBOARD']] as const).map(([t, label]) => (
          <div key={t} onClick={() => setTab(t)} style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, letterSpacing: '0.08em', padding: '10px 16px', cursor: 'pointer', borderBottom: `2px solid ${tab === t ? 'var(--accent2)' : 'transparent'}`, color: tab === t ? 'var(--accent2)' : 'var(--muted)', transition: 'all 0.12s' }}>
            {label}
          </div>
        ))}
      </div>

      <div style={{ flex: 1, padding: '16px 18px', maxWidth: 800, margin: '0 auto', width: '100%' }}>

        {/* Error / Status */}
        {error && <div style={{ background: 'rgba(255,60,60,0.08)', border: '1px solid var(--accent)', padding: '10px 14px', fontSize: 10, color: 'var(--accent)', marginBottom: 12 }}>⚠ {error}</div>}
        {statusMsg && <div style={{ background: 'rgba(60,255,180,0.08)', border: '1px solid var(--accent3)', padding: '10px 14px', fontSize: 11, color: 'var(--accent3)', marginBottom: 12 }}>{statusMsg}</div>}

        {/* ── RANKED TAB ── */}
        {tab === 'ranked' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '16px 20px' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--accent2)', marginBottom: 8 }}>RANKED BATTLE</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', lineHeight: 1.7, marginBottom: 14 }}>
                Your current squad will be submitted and matched against an opponent at a similar MMR.
                The battle resolves automatically — check back for results.
                {!stats?.placement_done && <span style={{ color: 'var(--accent2)' }}> You have <strong>{5 - (stats?.placements_played ?? 0)} placement matches</strong> remaining before you receive a rank.</span>}
              </div>

              {/* Squad preview */}
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
                {buildSlots.map((slot, i) => (
                  <div key={i} style={{ background: 'var(--panel2)', border: `1px solid ${slot ? 'var(--blue)' : 'var(--border)'}`, padding: '6px 10px', minWidth: 60, textAlign: 'center' }}>
                    {slot ? (
                      <>
                        <div style={{ fontSize: 16 }}>{(slot as any).icon}</div>
                        <div style={{ fontSize: 7, color: 'var(--muted)' }}>{(slot as any).power?.name}</div>
                      </>
                    ) : (
                      <div style={{ fontSize: 9, color: 'var(--border)' }}>EMPTY</div>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <button className="btn btn-primary" style={{ fontSize: 16 }} disabled={loading} onClick={handleRankedQueue}>
                  {loading ? 'FINDING MATCH...' : '⚔ ENTER RANKED QUEUE'}
                </button>
                <button className="btn btn-secondary" style={{ fontSize: 10 }} onClick={() => setScreen('build')}>
                  EDIT SQUAD →
                </button>
              </div>
            </div>

            {/* Rewards info */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '12px 16px' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 13, color: 'var(--muted)', letterSpacing: '0.12em', marginBottom: 8 }}>RANKED REWARDS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[['WIN','💎 +1 Diamond · 🪙 +60 Coins · +MMR'],['LOSS','🪙 +20 Coins · -MMR'],['PLACEMENT WIN','🪙 +80 Coins'],['PLACEMENT LOSS','🪙 +30 Coins']].map(([label, reward]) => (
                  <div key={label} style={{ fontSize: 9, color: 'var(--muted)' }}>
                    <span style={{ color: 'var(--accent2)', fontFamily: "'Bebas Neue', sans-serif", fontSize: 11 }}>{label}: </span>{reward}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ── CHALLENGE TAB ── */}
        {tab === 'challenge' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Create challenge */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '16px 20px' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent2)', marginBottom: 6 }}>CREATE A CHALLENGE</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12, lineHeight: 1.6 }}>
                Get a 6-character code to share with a friend. No MMR change — earns coins only.
              </div>
              <button className="btn btn-gold" disabled={loading} onClick={handleCreateChallenge}>
                {loading ? 'CREATING...' : '🤝 CREATE CHALLENGE'}
              </button>
              {myCode && (
                <div style={{ marginTop: 14, background: 'var(--panel2)', border: '2px solid var(--accent2)', padding: '12px 16px', textAlign: 'center' }}>
                  <div style={{ fontSize: 9, color: 'var(--muted)', letterSpacing: '0.14em', marginBottom: 4 }}>YOUR CHALLENGE CODE</div>
                  <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 40, color: 'var(--accent2)', letterSpacing: '0.2em' }}>{myCode}</div>
                  <div style={{ fontSize: 9, color: 'var(--muted)', marginTop: 4 }}>Share this code with your friend. Expires in 1 hour.</div>
                  <button style={{ marginTop: 8, fontSize: 9, padding: '4px 12px', border: '1px solid var(--border)', background: 'transparent', color: 'var(--muted)', cursor: 'pointer' }} onClick={() => { navigator.clipboard.writeText(myCode); }}>
                    📋 COPY CODE
                  </button>
                </div>
              )}
            </div>

            {/* Join challenge */}
            <div style={{ background: 'var(--panel)', border: '1px solid var(--border)', padding: '16px 20px' }}>
              <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent2)', marginBottom: 6 }}>JOIN A CHALLENGE</div>
              <div style={{ fontSize: 10, color: 'var(--muted)', marginBottom: 12 }}>Enter a friend's 6-character code to accept their challenge.</div>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  value={challengeCode}
                  onChange={e => setChallengeCode(e.target.value.toUpperCase())}
                  maxLength={6}
                  placeholder="ENTER CODE"
                  style={{ background: 'var(--panel2)', border: '1px solid var(--border)', color: 'var(--text)', padding: '10px 14px', fontSize: 20, fontFamily: "'Bebas Neue', sans-serif", letterSpacing: '0.2em', width: 160, outline: 'none', textTransform: 'uppercase' }}
                />
                <button className="btn btn-primary" disabled={loading || challengeCode.length < 6} onClick={handleJoinChallenge}>
                  {loading ? '...' : 'JOIN'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── MATCHES TAB ── */}
        {tab === 'matches' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent2)', marginBottom: 4 }}>MY MATCHES</div>
            {matches.length === 0 && <div style={{ fontSize: 10, color: 'var(--muted)' }}>No matches yet. Queue up for a ranked battle!</div>}
            {matches.map(m => {
              const isA    = m.player_a === authUser?.id
              const won    = m.winner === authUser?.id
              const mmrChg = isA ? m.mmr_change_a : m.mmr_change_b
              return (
                <div key={m.id} style={{ background: 'var(--panel)', border: `1px solid ${m.status === 'waiting' ? 'var(--accent2)' : won ? 'rgba(60,255,180,0.3)' : 'var(--border)'}`, padding: '12px 16px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
                  <div>
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 14, color: m.status === 'waiting' ? 'var(--accent2)' : won ? 'var(--accent3)' : 'var(--accent)' }}>
                      {m.status === 'waiting' ? '⏳ WAITING FOR OPPONENT' : won ? '⚔ VICTORY' : '⚔ DEFEAT'}
                    </div>
                    <div style={{ fontSize: 8, color: 'var(--muted)', marginTop: 2 }}>
                      {m.is_ranked ? 'RANKED' : 'CHALLENGE'} · {new Date(m.created_at).toLocaleDateString()}
                      {m.status === 'complete' && mmrChg !== 0 && (
                        <span style={{ color: mmrChg > 0 ? 'var(--accent3)' : 'var(--accent)', marginLeft: 8 }}>
                          {mmrChg > 0 ? '+' : ''}{mmrChg} MMR
                        </span>
                      )}
                    </div>
                  </div>
                  {m.challenge_code && m.status === 'waiting' && (
                    <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 20, color: 'var(--accent2)', letterSpacing: '0.15em' }}>{m.challenge_code}</div>
                  )}
                </div>
              )
            })}
            <button className="btn btn-secondary" style={{ marginTop: 8, fontSize: 10 }} onClick={() => { loadMatches(); loadStats() }}>↻ REFRESH</button>
          </div>
        )}

        {/* ── LEADERBOARD TAB ── */}
        {tab === 'leaderboard' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 18, color: 'var(--accent2)', marginBottom: 4 }}>🏆 GLOBAL LEADERBOARD</div>
            <div style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 80px 60px', gap: 4, padding: '6px 10px', fontSize: 7, color: 'var(--muted)', letterSpacing: '0.12em', borderBottom: '1px solid var(--border)' }}>
              <span>#</span><span>PLAYER</span><span>MMR</span><span>W/L</span><span>RANK</span>
            </div>
            {leaderboard.map((entry, i) => {
              const rank = getRankInfo(entry.mmr, true)
              const isMe = entry.player_id === authUser?.id
              return (
                <div key={entry.player_id} style={{ display: 'grid', gridTemplateColumns: '36px 1fr 80px 80px 60px', gap: 4, padding: '8px 10px', background: isMe ? 'rgba(60,143,255,0.08)' : 'var(--panel)', border: `1px solid ${isMe ? 'var(--blue)' : 'var(--border)'}`, alignItems: 'center' }}>
                  <span style={{ fontFamily: "'Bebas Neue', sans-serif", fontSize: 16, color: i === 0 ? '#ffd700' : i === 1 ? '#aaa' : i === 2 ? '#cd7f32' : 'var(--muted)' }}>
                    {i + 1}
                  </span>
                  <span style={{ fontSize: 11, color: isMe ? 'var(--blue)' : 'var(--text)', fontFamily: "'Bebas Neue', sans-serif" }}>
                    {entry.username} {isMe && '(YOU)'}
                  </span>
                  <span style={{ fontSize: 11, color: rank.color, fontFamily: "'Bebas Neue', sans-serif" }}>{entry.mmr}</span>
                  <span style={{ fontSize: 9, color: 'var(--muted)' }}>{entry.wins}W {entry.losses}L</span>
                  <span style={{ fontSize: 9, color: rank.color }}>{rank.icon} {rank.tier}</span>
                </div>
              )
            })}
            {leaderboard.length === 0 && <div style={{ fontSize: 10, color: 'var(--muted)', textAlign: 'center', padding: 24 }}>No ranked players yet — be the first!</div>}
          </div>
        )}
      </div>
    </div>
  )
}