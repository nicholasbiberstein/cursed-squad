// ============================================================
// STRIPE WEBHOOK HANDLER
// IMPORTANT: bodyParser must be disabled so Stripe gets raw body
// ============================================================

// Tell Vercel NOT to parse the body — Stripe needs the raw bytes
export const config = { api: { bodyParser: false } }

const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY)
const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

// Read raw body from request stream
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
    console.error('[Webhook] Signature verification failed:', err.message)
    res.status(400).send(`Webhook Error: ${err.message}`)
    return
  }

  if (event.type === 'checkout.session.completed') {
    const session  = event.data.object
    const userId   = session.metadata?.userId
    const diamonds = parseInt(session.metadata?.diamonds ?? '0', 10)
    const packId   = session.metadata?.packId

    if (!userId || !diamonds) {
      console.error('[Webhook] Missing metadata:', session.metadata)
      res.status(200).json({ received: true }); return
    }

    try {
      // Fetch current diamonds
      const { data: save, error: fetchErr } = await supabase
        .from('saves')
        .select('diamonds')
        .eq('player_id', userId)
        .single()

      if (fetchErr || !save) {
        console.error('[Webhook] Save not found for user:', userId)
        res.status(200).json({ received: true }); return
      }

      // Add diamonds
      const newTotal = save.diamonds + diamonds
      const { error: updateErr } = await supabase
        .from('saves')
        .update({ diamonds: newTotal })
        .eq('player_id', userId)

      if (updateErr) {
        console.error('[Webhook] Failed to update diamonds:', updateErr.message)
      } else {
        console.log(`[Webhook] Added ${diamonds} diamonds to user ${userId}. New total: ${newTotal}`)
      }

      // Log the purchase
      await supabase.from('purchases').insert({
        player_id:  userId,
        item_type:  'diamonds',
        item_id:    packId,
        amount_usd: session.amount_total / 100,
        diamonds,
      })

    } catch (err) {
      console.error('[Webhook] Error processing payment:', err.message)
    }
  }

  res.status(200).json({ received: true })
}