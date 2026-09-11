import { verifyAuth, jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

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
  try {
    const body = JSON.parse(event.body || '{}')
    raffleId = typeof body.raffleId === 'string' ? body.raffleId.trim() : ''
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
  const key = `raffles/${raffleId}.json`
  const raffle = await store.get(key, { type: 'json' })

  let index = []
  try {
    const existing = await store.get('raffles/index.json', { type: 'json' })
    if (Array.isArray(existing)) index = existing
  } catch {
    index = []
  }

  const inIndex = index.some((item) => item.id === raffleId)
  if (!raffle && !inIndex) {
    return {
      statusCode: 404,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'قرعه‌کشی پیدا نشد' }),
    }
  }

  if (typeof store.delete === 'function') {
    await store.delete(key)
  } else {
    // Fallback: overwrite with tombstone if delete is unavailable
    await store.setJSON(key, { id: raffleId, deleted: true })
  }

  const nextIndex = index.filter((item) => item.id !== raffleId)
  await store.setJSON('raffles/index.json', nextIndex)

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ deleted: true, raffleId }),
  }
}
