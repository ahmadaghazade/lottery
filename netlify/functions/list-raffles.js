import { verifyAuth, jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

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

  const store = await getDataStore(event)
  let index = []
  try {
    const existing = await store.get('raffles/index.json', { type: 'json' })
    if (Array.isArray(existing)) index = existing
  } catch {
    index = []
  }

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ raffles: index }),
  }
}
