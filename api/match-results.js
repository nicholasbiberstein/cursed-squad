// ============================================================
// MATCH RESULT
// GET /api/match-result?matchId=xxx&userId=xxx
// Returns match result, MMR changes, and replay data.
// ============================================================

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  if (req.method !== 'GET') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { matchId, userId } = req.query
  if (!matchId || !userId) { res.status(400).json({ error: 'Missing matchId or userId' }); return }

  try {
    const { data: match, error } = await supabase
      .from('matches')
      .select('*')
      .eq('id', matchId)
      .single()

    if (error || !match) { res.status(404).json({ error: 'Match not found' }); return }
    if (match.player_a !== userId && match.player_b !== userId) {
      res.status(403).json({ error: 'Not your match' }); return
    }

    // Get both player stats for rank display
    const { data: statsA } = await supabase.from('player_stats').select('*').eq('player_id', match.player_a).single()
    const { data: statsB } = await supabase.from('player_stats').select('*').eq('player_id', match.player_b).single()

    // Get usernames
    const { data: playerA } = await supabase.from('players').select('username').eq('id', match.player_a).single()
    const { data: playerB } = await supabase.from('players').select('username').eq('id', match.player_b).single()

    const isPlayerA = userId === match.player_a
    const won       = match.winner === userId
    const mmrChange = isPlayerA ? match.mmr_change_a : match.mmr_change_b

    res.status(200).json({
      matchId:    match.id,
      status:     match.status,
      won,
      winner:     match.winner,
      mmrChange,
      replay:     match.replay,
      opponent: {
        id:       isPlayerA ? match.player_b : match.player_a,
        username: isPlayerA ? playerB?.username : playerA?.username,
        stats:    isPlayerA ? statsB : statsA,
      },
      myStats:    isPlayerA ? statsA : statsB,
      isRanked:   match.is_ranked,
    })
  } catch (err) {
    console.error('[match-result] Error:', err.message)
    res.status(500).json({ error: err.message })
  }
}