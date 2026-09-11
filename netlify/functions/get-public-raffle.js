import { jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 7) return ''
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`
}

function eligibleEntries(raffle) {
  const excluded = new Set(raffle.excludedPersonKeys || [])
  return (raffle.entries || []).filter((entry) => !excluded.has(entry.personKey))
}

function findNextPrize(raffle) {
  const prizes = [...(raffle.prizes || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  for (const prize of prizes) {
    const drawn = (raffle.winners || []).filter((w) => w.prizeId === prize.id).length
    if (drawn < prize.quantity) {
      return {
        id: prize.id,
        name: prize.name,
        quantity: prize.quantity,
        order: prize.order,
        drawnCount: drawn,
        remainingCount: prize.quantity - drawn,
      }
    }
  }
  return null
}

function toPublicRaffle(raffle) {
  const entries = raffle.entries || []
  const remaining = eligibleEntries(raffle)
  const nextPrize = findNextPrize(raffle)
  const prizes = [...(raffle.prizes || [])]
    .sort((a, b) => (a.order || 0) - (b.order || 0))
    .map((p) => ({
      id: p.id,
      name: p.name,
      quantity: p.quantity,
      order: p.order,
      drawnCount: (raffle.winners || []).filter((w) => w.prizeId === p.id).length,
    }))

  return {
    id: raffle.id,
    name: raffle.name,
    status: raffle.status,
    entryCount: entries.length,
    uniquePeople: new Set(entries.map((e) => e.personKey)).size,
    remainingTickets: remaining.length,
    remainingPeople: new Set(remaining.map((e) => e.personKey)).size,
    prizeCount: prizes.length,
    totalPrizeSlots: prizes.reduce((sum, p) => sum + (p.quantity || 0), 0),
    winnerCount: (raffle.winners || []).length,
    prizes,
    winners: (raffle.winners || []).map((w) => ({
      id: w.id,
      prizeId: w.prizeId,
      prizeName: w.prizeName,
      name: w.name,
      phoneMasked: maskPhone(w.phone),
      drawnAt: w.drawnAt,
    })),
    nextPrize,
    eligibleNames: remaining.map((entry) => entry.name),
    completed: raffle.status === 'completed' || (!nextPrize && prizes.length > 0),
  }
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions()

  if (event.httpMethod !== 'GET') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'متد مجاز نیست' }),
    }
  }

  const raffleId = event.queryStringParameters?.id?.trim()
  if (!raffleId) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'شناسه قرعه‌کشی الزامی است' }),
    }
  }

  const store = await getDataStore(event)
  const raffle = await store.get(`raffles/${raffleId}.json`, { type: 'json' })

  if (!raffle || !raffle.id) {
    return {
      statusCode: 404,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'قرعه‌کشی پیدا نشد' }),
    }
  }

  if (raffle.status === 'draft' || !Array.isArray(raffle.prizes) || raffle.prizes.length === 0) {
    return {
      statusCode: 404,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'این قرعه‌کشی هنوز برای نمایش عمومی آماده نیست' }),
    }
  }

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify(toPublicRaffle(raffle)),
  }
}
