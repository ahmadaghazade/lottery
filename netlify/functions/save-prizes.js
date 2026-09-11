import { randomUUID } from 'crypto'
import { verifyAuth, jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

function normalizePrizes(input) {
  if (!Array.isArray(input)) return null

  const prizes = []
  for (let i = 0; i < input.length; i++) {
    const item = input[i] || {}
    const name = typeof item.name === 'string' ? item.name.trim() : ''
    const quantity = Number(item.quantity)

    if (!name) {
      return { error: `نام جایزه در ردیف ${i + 1} الزامی است` }
    }
    if (!Number.isInteger(quantity) || quantity < 1) {
      return { error: `تعداد برندگان جایزه «${name}» باید عدد صحیح حداقل ۱ باشد` }
    }

    prizes.push({
      id: typeof item.id === 'string' && item.id ? item.id : randomUUID(),
      name,
      quantity,
      order: i + 1,
    })
  }

  return { prizes }
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
  let prizesInput
  try {
    const body = JSON.parse(event.body || '{}')
    raffleId = typeof body.raffleId === 'string' ? body.raffleId.trim() : ''
    prizesInput = body.prizes
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

  const normalized = normalizePrizes(prizesInput)
  if (!normalized || normalized.error) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: normalized?.error || 'لیست جوایز نامعتبر است' }),
    }
  }

  if (normalized.prizes.length === 0) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'حداقل یک جایزه لازم است' }),
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

  if (Array.isArray(raffle.winners) && raffle.winners.length > 0) {
    return {
      statusCode: 409,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'پس از شروع قرعه‌کشی نمی‌توان جوایز را تغییر داد' }),
    }
  }

  const totalPrizeSlots = normalized.prizes.reduce((sum, p) => sum + p.quantity, 0)
  const entryCount = (raffle.entries || []).length
  if (totalPrizeSlots > entryCount) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({
        error: `مجموع تعداد جوایز (${totalPrizeSlots}) بیشتر از تعداد بلیط‌ها (${entryCount}) است`,
      }),
    }
  }

  const status = 'ready'
  const updated = {
    ...raffle,
    prizes: normalized.prizes,
    status,
  }

  await store.setJSON(`raffles/${raffleId}.json`, updated)
  await updateIndexStatus(store, raffleId, status)

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      raffleId,
      status,
      prizes: updated.prizes,
      prizeCount: updated.prizes.length,
      totalPrizeSlots,
    }),
  }
}
