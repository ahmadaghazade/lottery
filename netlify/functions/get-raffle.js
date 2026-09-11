import { verifyAuth, jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

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

function summarizeRaffle(raffle) {
  const entries = raffle.entries || []
  const uniquePeople = new Set(entries.map((e) => e.personKey)).size
  const remaining = eligibleEntries(raffle)
  const remainingPeople = new Set(remaining.map((e) => e.personKey)).size
  const nextPrize = findNextPrize(raffle)
  const totalPrizeSlots = (raffle.prizes || []).reduce((sum, p) => sum + (p.quantity || 0), 0)

  return {
    id: raffle.id,
    name: raffle.name,
    status: raffle.status,
    createdAt: raffle.createdAt,
    entryCount: entries.length,
    uniquePeople,
    prizeCount: (raffle.prizes || []).length,
    totalPrizeSlots,
    winnerCount: (raffle.winners || []).length,
    prizes: raffle.prizes || [],
    winners: raffle.winners || [],
    remainingTickets: remaining.length,
    remainingPeople,
    nextPrize,
    completed: raffle.status === 'completed' || (!nextPrize && (raffle.prizes || []).length > 0),
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

  const auth = verifyAuth(event)
  if (!auth.ok) {
    return {
      statusCode: auth.statusCode,
      headers: jsonHeaders,
      body: auth.body,
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

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify(summarizeRaffle(raffle)),
  }
}
