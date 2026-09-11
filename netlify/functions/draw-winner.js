import { randomUUID, randomInt } from 'crypto'
import { verifyAuth, jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

function eligibleEntries(raffle) {
  const excluded = new Set(raffle.excludedPersonKeys || [])
  return (raffle.entries || []).filter((entry) => !excluded.has(entry.personKey))
}

function winnersForPrize(raffle, prizeId) {
  return (raffle.winners || []).filter((w) => w.prizeId === prizeId)
}

function findNextPrize(raffle) {
  const prizes = [...(raffle.prizes || [])].sort((a, b) => (a.order || 0) - (b.order || 0))
  for (const prize of prizes) {
    const drawn = winnersForPrize(raffle, prize.id).length
    if (drawn < prize.quantity) {
      return {
        ...prize,
        drawnCount: drawn,
        remainingCount: prize.quantity - drawn,
      }
    }
  }
  return null
}

async function updateIndexStatus(store, raffleId, status) {
  let index = []
  try {
    const existing = await store.get('raffles/index.json', { type: 'json' })
    if (Array.isArray(existing)) index = existing
  } catch {
    index = []
  }
  const next = index.map((item) => (item.id === raffleId ? { ...item, status } : item))
  await store.setJSON('raffles/index.json', next)
}

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions()

  if (event.httpMethod !== 'POST') {
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

  let raffleId
  let prizeId
  try {
    const body = JSON.parse(event.body || '{}')
    raffleId = typeof body.raffleId === 'string' ? body.raffleId.trim() : ''
    prizeId = typeof body.prizeId === 'string' ? body.prizeId.trim() : ''
  } catch {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'درخواست نامعتبر است' }),
    }
  }

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

  if (!Array.isArray(raffle.prizes) || raffle.prizes.length === 0) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'ابتدا جوایز را پیکربندی کنید' }),
    }
  }

  if (raffle.status === 'completed') {
    return {
      statusCode: 409,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'قرعه‌کشی به پایان رسیده است' }),
    }
  }

  if (raffle.status !== 'ready' && raffle.status !== 'drawing') {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'قرعه‌کشی هنوز برای اجرا آماده نیست' }),
    }
  }

  const nextPrize = findNextPrize(raffle)
  if (!nextPrize) {
    return {
      statusCode: 409,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'همه جوایز از قبل برنده دارند' }),
    }
  }

  if (prizeId && prizeId !== nextPrize.id) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: `نوبت جایزه «${nextPrize.name}» است`,
        nextPrizeId: nextPrize.id,
      }),
    }
  }

  const pool = eligibleEntries(raffle)
  if (pool.length === 0) {
    return {
      statusCode: 409,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'شرکت‌کننده واجد شرایطی باقی نمانده است' }),
    }
  }

  const picked = pool[randomInt(pool.length)]
  const spinNames = pool.map((entry) => entry.name)
  const winner = {
    id: randomUUID(),
    prizeId: nextPrize.id,
    prizeName: nextPrize.name,
    entryId: picked.id,
    personKey: picked.personKey,
    name: picked.name,
    phone: picked.phone || '',
    drawnAt: new Date().toISOString(),
  }

  const winners = [...(raffle.winners || []), winner]
  const excludedPersonKeys = Array.from(
    new Set([...(raffle.excludedPersonKeys || []), picked.personKey]),
  )

  const tentative = { ...raffle, winners, excludedPersonKeys }
  const stillNext = findNextPrize(tentative)
  const status = stillNext ? 'drawing' : 'completed'

  const updated = {
    ...tentative,
    status,
  }

  await store.setJSON(`raffles/${raffleId}.json`, updated)
  await updateIndexStatus(store, raffleId, status)

  const remaining = eligibleEntries(updated)
  const remainingTickets = remaining.length
  const remainingPeople = new Set(remaining.map((e) => e.personKey)).size

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      winner,
      spinNames,
      status,
      remainingTickets,
      remainingPeople,
      nextPrize: stillNext
        ? {
            id: stillNext.id,
            name: stillNext.name,
            quantity: stillNext.quantity,
            order: stillNext.order,
            drawnCount: stillNext.drawnCount,
            remainingCount: stillNext.remainingCount,
          }
        : null,
      winnerCount: winners.length,
      completed: status === 'completed',
    }),
  }
}
