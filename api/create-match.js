// ============================================================
// CREATE MATCH
// POST /api/create-match
// Creates a ranked match or friend challenge.
// Body: { userId, squad, isRanked, challengeCode? }
// ============================================================

const { createClient } = require('@supabase/supabase-js')
const { nanoid } = require('nanoid')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { userId, squad, isRanked, challengeCode } = req.body ?? {}
  if (!userId || !squad) { res.status(400).json({ error: 'Missing userId or squad' }); return }

  try {
    // ── Friend challenge — join existing ─────────────────────
    if (challengeCode) {
      const { data: existing } = await supabase
        .from('matches')
        .select('*')
        .eq('challenge_code', challengeCode)
        .eq('status', 'waiting')
        .single()

      if (!existing) { res.status(404).json({ error: 'Challenge not found or expired' }); return }
      if (existing.player_a === userId) { res.status(400).json({ error: 'Cannot join your own challenge' }); return }

      // Join the challenge — run the battle
      const result = await runBattle(existing.squad_a, squad, existing.player_a, userId, false)

      const { data: match } = await supabase
        .from('matches')
        .update({
          player_b: userId,
          squad_b:  squad,
          status:   'complete',
          winner:   result.winner === 'a' ? existing.player_a : userId,
          replay:   result.replay,
        })
        .eq('id', existing.id)
        .select()
        .single()

      // Notify both players
      await notifyPlayers(existing.player_a, userId, result, match.id, false)

      res.status(200).json({ matchId: match.id, result })
      return
    }

    // ── Ranked queue — find opponent ──────────────────────────
    if (isRanked) {
      // Get player's MMR
      const { data: stats } = await supabase
        .from('player_stats')
        .select('mmr, placement_done, placements_played')
        .eq('player_id', userId)
        .single()

      const playerMMR = stats?.mmr ?? 0

      // Find waiting match within 300 MMR (or any if in placement)
      const { data: waiting } = await supabase
        .from('matches')
        .select('*')
        .eq('status', 'waiting')
        .eq('is_ranked', true)
        .neq('player_a', userId)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: true })
        .limit(10)

      // Pick closest MMR match
      const opponent = waiting?.find(m => {
        if (!stats?.placement_done) return true  // Placement matches anyone
        const opponentMMR = m.mmr_change_a ?? 0  // stored temporarily
        return Math.abs(opponentMMR - playerMMR) <= 300
      }) ?? waiting?.[0]

      if (opponent) {
        // Found an opponent — run the battle
        const isPlacement = !stats?.placement_done
        const result = await runBattle(opponent.squad_a, squad, opponent.player_a, userId, true)

        // Update match
        const { data: match } = await supabase
          .from('matches')
          .update({
            player_b: userId,
            squad_b:  squad,
            status:   'complete',
            winner:   result.winner === 'a' ? opponent.player_a : userId,
            replay:   result.replay,
          })
          .eq('id', opponent.id)
          .select()
          .single()

        // Update MMR for both players
        await updateMMR(opponent.player_a, userId, result, isPlacement)

        // Notify both
        await notifyPlayers(opponent.player_a, userId, result, match.id, true)

        res.status(200).json({ matchId: match.id, result })
        return
      }

      // No opponent found — create waiting match
      const { data: newMatch } = await supabase
        .from('matches')
        .insert({
          player_a:   userId,
          squad_a:    squad,
          status:     'waiting',
          is_ranked:  true,
          mmr_change_a: playerMMR,  // store MMR for matchmaking
          expires_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        })
        .select()
        .single()

      res.status(200).json({ matchId: newMatch.id, status: 'waiting' })
      return
    }

    // ── Create friend challenge ───────────────────────────────
    const code = nanoid(6).toUpperCase()
    const { data: challenge } = await supabase
      .from('matches')
      .insert({
        player_a:      userId,
        squad_a:       squad,
        status:        'waiting',
        is_ranked:     false,
        challenge_code: code,
        expires_at:    new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      })
      .select()
      .single()

    res.status(200).json({ matchId: challenge.id, challengeCode: code, status: 'waiting' })

  } catch (err) {
    console.error('[create-match] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}

async function runBattle(squadA, squadB, playerAId, playerBId, isRanked) {
  // Tag squads with teams
  const unitsA = squadA.filter(Boolean).map((u, i) => ({ ...u, id: `mp_a_${i}`, team: 'player' }))
  const unitsB = squadB.filter(Boolean).map((u, i) => ({ ...u, id: `mp_b_${i}`, team: 'enemy' }))

  // Simple simulation: compare total power
  // Full MatchEngine simulation would be imported here in a monorepo
  // For now use stat-based resolution with randomness
  const scoreA = unitsA.reduce((s, u) => s + (u.power?.damage ?? 20) + u.maxHp, 0) * (0.8 + Math.random() * 0.4)
  const scoreB = unitsB.reduce((s, u) => s + (u.power?.damage ?? 20) + u.maxHp, 0) * (0.8 + Math.random() * 0.4)

  const winner = scoreA >= scoreB ? 'a' : 'b'
  const replay = [
    { round: 1, unitId: 'system', action: 'battle_resolved', targets: [], damage: Math.abs(scoreA - scoreB) }
  ]

  return { winner, rounds: Math.floor(3 + Math.random() * 8), replay, survivors: { a: winner === 'a' ? 2 : 0, b: winner === 'b' ? 2 : 0 } }
}

async function updateMMR(playerAId, playerBId, result, isPlacement) {
  const { data: statsA } = await supabase.from('player_stats').select('*').eq('player_id', playerAId).single()
  const { data: statsB } = await supabase.from('player_stats').select('*').eq('player_id', playerBId).single()

  if (!statsA || !statsB) return

  const mmrA = statsA.mmr ?? 0
  const mmrB = statsB.mmr ?? 0

  const wonA = result.winner === 'a'
  const wonB = result.winner === 'b'

  const changeA = wonA ? (mmrB > mmrA ? 30 : mmrB > mmrA - 200 ? 20 : 10) : -15
  const changeB = wonB ? (mmrA > mmrB ? 30 : mmrA > mmrB - 200 ? 20 : 10) : -15

  const newMmrA = Math.max(0, mmrA + changeA)
  const newMmrB = Math.max(0, mmrB + changeB)

  const placementsA = (statsA.placements_played ?? 0) + 1
  const placementsB = (statsB.placements_played ?? 0) + 1

  await supabase.from('player_stats').upsert({
    player_id:          playerAId,
    mmr:                newMmrA,
    wins:               statsA.wins + (wonA ? 1 : 0),
    losses:             statsA.losses + (wonA ? 0 : 1),
    placements_played:  placementsA,
    placement_done:     placementsA >= 5,
    rank_tier:          getTier(newMmrA, placementsA >= 5),
    updated_at:         new Date().toISOString(),
  }, { onConflict: 'player_id' })

  await supabase.from('player_stats').upsert({
    player_id:          playerBId,
    mmr:                newMmrB,
    wins:               statsB.wins + (wonB ? 1 : 0),
    losses:             statsB.losses + (wonB ? 0 : 1),
    placements_played:  placementsB,
    placement_done:     placementsB >= 5,
    rank_tier:          getTier(newMmrB, placementsB >= 5),
    updated_at:         new Date().toISOString(),
  }, { onConflict: 'player_id' })

  // Update match with MMR changes
  await supabase.from('matches').update({ mmr_change_a: changeA, mmr_change_b: changeB })

  // Give rewards via saves
  const rewardWin  = { coins: 60, diamonds: 1 }
  const rewardLoss = { coins: 20, diamonds: 0 }

  await giveReward(playerAId, wonA ? rewardWin : rewardLoss)
  await giveReward(playerBId, wonB ? rewardWin : rewardLoss)
}

async function giveReward(playerId, reward) {
  const { data: save } = await supabase.from('saves').select('coins, diamonds').eq('player_id', playerId).single()
  if (!save) return
  await supabase.from('saves').update({
    coins:    save.coins    + reward.coins,
    diamonds: save.diamonds + reward.diamonds,
  }).eq('player_id', playerId)
}

async function notifyPlayers(playerAId, playerBId, result, matchId, isRanked) {
  const winMsg  = `⚔ Match result: YOU WON! ${isRanked ? '+MMR earned.' : 'Coins rewarded.'}`
  const lossMsg = `⚔ Match result: You lost. ${isRanked ? 'MMR decreased.' : 'Coins rewarded.'}`

  await supabase.from('notifications').insert([
    { player_id: playerAId, type: 'match_result', message: result.winner === 'a' ? winMsg : lossMsg, data: { matchId } },
    { player_id: playerBId, type: 'match_result', message: result.winner === 'b' ? winMsg : lossMsg, data: { matchId } },
  ])
}

function getTier(mmr, placementDone) {
  if (!placementDone) return 'UNRANKED'
  if (mmr < 500)  return 'BRONZE'
  if (mmr < 1000) return 'SILVER'
  if (mmr < 1500) return 'GOLD'
  if (mmr < 2000) return 'PLATINUM'
  if (mmr < 3000) return 'DIAMOND'
  if (mmr < 4000) return 'MASTER'
  return 'LEGEND'
}