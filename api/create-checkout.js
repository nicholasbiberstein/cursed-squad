// ============================================================
// VERCEL SERVERLESS FUNCTION — Create Stripe Checkout Session
// POST /api/create-checkout
// ============================================================

const DIAMOND_PACKS = {
  starter:  { diamonds: 10,   price: 99,    name: '💎 10 Diamonds — Starter Pack' },
  standard: { diamonds: 60,   price: 499,   name: '💎 60 Diamonds — Standard Pack' },
  value:    { diamonds: 130,  price: 999,   name: '💎 130 Diamonds — Value Pack' },
  pro:      { diamonds: 280,  price: 1999,  name: '💎 280 Diamonds — Pro Pack' },
  elite:    { diamonds: 650,  price: 4999,  name: '💎 650 Diamonds — Elite Pack' },
  legend:   { diamonds: 1400, price: 9999,  name: '💎 1400 Diamonds — Legend Pack' },
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  if (req.method === 'OPTIONS') { res.status(200).end(); return }
  if (req.method !== 'POST')   { res.status(405).json({ error: 'Method not allowed' }); return }

  const { packId, userId, userEmail } = req.body ?? {}
  if (!packId || !userId || !userEmail) {
    res.status(400).json({ error: 'Missing required fields' }); return
  }

  const pack = DIAMOND_PACKS[packId]
  if (!pack) { res.status(400).json({ error: 'Invalid pack ID' }); return }

  try {
    // Dynamically require stripe — it's in root node_modules
    const Stripe = require('stripe')
    const stripe = Stripe(process.env.STRIPE_SECRET_KEY)

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
            name: pack.name,
            description: `Cursed Squad — ${pack.diamonds} diamonds added to your account instantly.`,
          },
        },
        quantity: 1,
      }],
      metadata: { packId, userId, diamonds: String(pack.diamonds) },
      success_url: `${siteUrl}?purchase=success&diamonds=${pack.diamonds}`,
      cancel_url:  `${siteUrl}?purchase=cancelled`,
    })

    res.status(200).json({ url: session.url })
  } catch (err) {
    console.error('[Stripe] Error:', err.message)
    res.status(500).json({ error: err.message ?? 'Failed to create checkout session' })
  }
}