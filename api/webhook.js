// ============================================================
// STRIPE WEBHOOK — handles both diamond purchases and spin packs
// ============================================================

export const config = { api: { bodyParser: false } }

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL    ?? '',
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
)

console.log('[Webhook] ENV check:', {
  hasSupabaseUrl:   !!process.env.VITE_SUPABASE_URL,
  hasServiceRole:   !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  hasStripeSecret:  !!process.env.STRIPE_SECRET_KEY,
  hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
})

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = []
    req.on('data', chunk => chunks.push(chunk))
    req.on('end',  () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') { res.status(405).end(); return }

  const sig    = req.headers['stripe-signature']
  const secret = process.env.STRIPE_WEBHOOK_SECRET

  let event
  try {
    const rawBody = await getRawBody(req)
    event = stripe.webhooks.constructEvent(rawBody, sig, secret)
  } catch (err) {
    console.error('[Webhook] Signature failed:', err.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object
    const meta    = session.metadata ?? {}
    const type    = meta.type ?? 'diamonds'

    // Idempotency: Stripe retries and duplicate deliveries must not credit twice.
    // The session itself is the ledger (metadata.fulfilled); no DB change needed.
    let claimed = false
    try {
      claimed = await claimSession(session.id)
      if (!claimed) {
        console.log(`[Webhook] Duplicate delivery for session ${session.id}, skipping`)
        res.status(200).json({ received: true, duplicate: true })
        return
      }
      if (type === 'spin_pack') {
        await handleSpinPack(session, meta)
      } else {
        await handleDiamondPurchase(session, meta)
      }
    } catch (err) {
      console.error('[Webhook] Fulfilment failed:', err.message)
      if (claimed) await releaseSession(session.id).catch(() => {})
      res.status(500).json({ error: 'Fulfilment failed, will retry' })
      return
    }
  }

  res.status(200).json({ received: true })
}

// Returns true if this call won the right to fulfil the session, false if already fulfilled.
async function claimSession(sessionId) {
  const fresh = await stripe.checkout.sessions.retrieve(sessionId)
  if (fresh.metadata?.fulfilled === '1') return false
  await stripe.checkout.sessions.update(sessionId, { metadata: { fulfilled: '1' } })
  return true
}

// Empty string unsets the key in Stripe, so a failed fulfilment can be retried.
async function releaseSession(sessionId) {
  await stripe.checkout.sessions.update(sessionId, { metadata: { fulfilled: '' } })
}

async function handleDiamondPurchase(session, meta) {
  const userId   = meta.userId
  const diamonds = parseInt(meta.diamonds ?? '0', 10)
  if (!userId || !diamonds) return

  const { data: sv } = await supabase.from('saves').select('diamonds').eq('player_id', userId).single()
  if (!sv) return

  await supabase.from('saves').update({ diamonds: sv.diamonds + diamonds }).eq('player_id', userId)
  await supabase.from('purchases').insert({ player_id: userId, item_type: 'diamonds', item_id: meta.packId, amount_usd: session.amount_total / 100, diamonds })
  console.log(`[Webhook] +${diamonds} diamonds → user ${userId}`)
}

async function handleSpinPack(session, meta) {
  const userId         = meta.userId
  const spins          = parseInt(meta.spins          ?? '0', 10)
  const tickets        = parseInt(meta.tickets        ?? '0', 10)
  const coins          = parseInt(meta.coins          ?? '0', 10)
  const diamonds       = parseInt(meta.diamonds       ?? '0', 10)
  const commonTokens   = parseInt(meta.commonTokens   ?? '0', 10)
  const rareTokens     = parseInt(meta.rareTokens     ?? '0', 10)
  const epicTokens     = parseInt(meta.epicTokens     ?? '0', 10)
  const legendaryTokens = parseInt(meta.legendaryTokens ?? '0', 10)

  if (!userId) return

  // Update mythical_progress: add paid spins + tickets
  const { data: mp } = await supabase.from('mythical_progress').select('paid_spins, tickets').eq('player_id', userId).single()
  if (mp) {
    await supabase.from('mythical_progress').update({
      paid_spins: (mp.paid_spins ?? 0) + spins,
      tickets:    (mp.tickets   ?? 0) + tickets,
    }).eq('player_id', userId)
  }

  // Update saves: coins + diamonds
  if (coins > 0 || diamonds > 0) {
    const { data: sv } = await supabase.from('saves').select('coins, diamonds').eq('player_id', userId).single()
    if (sv) await supabase.from('saves').update({ coins: sv.coins + coins, diamonds: sv.diamonds + diamonds }).eq('player_id', userId)
  }

  // Update player_events: tokens
  if (commonTokens > 0 || rareTokens > 0 || epicTokens > 0 || legendaryTokens > 0) {
    const { data: pe } = await supabase.from('player_events').select('common_tokens, rare_tokens').eq('player_id', userId).single()
    if (pe) {
      await supabase.from('player_events').update({
        common_tokens: (pe.common_tokens ?? 0) + commonTokens + epicTokens,
        rare_tokens:   (pe.rare_tokens   ?? 0) + rareTokens + legendaryTokens,
      }).eq('player_id', userId)
    }
  }

  // Log purchase + update VIP spending
  await supabase.from('purchases').insert({ player_id: userId, item_type: 'spin_pack', item_id: meta.packId, amount_usd: session.amount_total / 100, diamonds: 0 })
  await updateVIPSpending(userId, session.amount_total / 100)

  console.log(`[Webhook] Spin pack ${meta.packId} → user ${userId}: +${spins} spins, +${tickets} tickets`)
}

async function updateVIPSpending(userId, amountUsd) {
  const { data } = await supabase.from('saves').select('total_spent').eq('player_id', userId).single()
  const current  = data?.total_spent ?? 0
  const newTotal = current + amountUsd
  await supabase.from('saves').update({ total_spent: newTotal }).eq('player_id', userId)
}
