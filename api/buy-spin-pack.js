// ============================================================
// BUY SPIN PACK — Stripe checkout for mythical event spin packs
// POST /api/buy-spin-pack
// Body: { packId, userId, userEmail }
// ============================================================

const SPIN_PACKS = {
  spark:   { price: 99,   name: 'Spark Pack — 3 Spins',    spins: 3,   tickets: 3,   coins: 200,   diamonds: 0,  commonTokens: 1, rareTokens: 0, legendaryTokens: 0 },
  surge:   { price: 499,  name: 'Surge Pack — 20 Spins',   spins: 20,  tickets: 20,  coins: 1000,  diamonds: 2,  commonTokens: 0, rareTokens: 1, legendaryTokens: 0 },
  storm:   { price: 999,  name: 'Storm Pack — 45 Spins',   spins: 45,  tickets: 45,  coins: 2500,  diamonds: 5,  commonTokens: 1, rareTokens: 0, legendaryTokens: 0, epicTokens: 1 },
  thunder: { price: 1999, name: 'Thunder Pack — 100 Spins', spins: 100, tickets: 100, coins: 6000,  diamonds: 15, commonTokens: 0, rareTokens: 1, legendaryTokens: 0, epicTokens: 1 },
  legend:  { price: 4999, name: 'Legend Pack — 250 Spins', spins: 250, tickets: 250, coins: 15000, diamonds: 40, commonTokens: 0, rareTokens: 1, legendaryTokens: 1, epicTokens: 1 },
  god:     { price: 9999, name: 'God Pack — 600 Spins',    spins: 600, tickets: 600, coins: 40000, diamonds: 100, commonTokens: 0, rareTokens: 0, legendaryTokens: 2, epicTokens: 2 },
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return }

  const { packId, userId, userEmail } = req.body ?? {}
  if (!packId || !userId || !userEmail) { res.status(400).json({ error: 'Missing required fields' }); return }

  const pack = SPIN_PACKS[packId]
  if (!pack) { res.status(400).json({ error: 'Invalid pack ID' }); return }

  try {
    const Stripe  = require('stripe')
    const stripe  = Stripe(process.env.STRIPE_SECRET_KEY)
    const siteUrl = process.env.VITE_SITE_URL ?? 'https://cursed-squad.com'

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      customer_email: userEmail,
      line_items: [{
        price_data: {
          currency: 'usd',
          unit_amount: pack.price,
          product_data: {
            name: `Cursed Squad — ${pack.name}`,
            description: `${pack.spins} roulette spins + ${pack.tickets} tickets + bonus rewards`,
          },
        },
        quantity: 1,
      }],
      metadata: {
        type:           'spin_pack',
        packId,
        userId,
        spins:          String(pack.spins),
        tickets:        String(pack.tickets),
        coins:          String(pack.coins),
        diamonds:       String(pack.diamonds),
        commonTokens:   String(pack.commonTokens ?? 0),
        rareTokens:     String(pack.rareTokens   ?? 0),
        epicTokens:     String(pack.epicTokens   ?? 0),
        legendaryTokens: String(pack.legendaryTokens ?? 0),
      },
      success_url: `${siteUrl}?purchase=success&type=spin_pack&spins=${pack.spins}`,
      cancel_url:  `${siteUrl}?purchase=cancelled`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[buy-spin-pack] Error:', err.message)
    res.status(500).json({ error: err.message ?? 'Failed to create checkout' })
  }
}