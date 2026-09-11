import { randomUUID } from 'crypto'
import { verifyAuth, jsonHeaders, handleOptions } from './utils/auth.js'
import { getDataStore } from './utils/blobs.js'

function normalizePhone(phone) {
  if (phone == null) return ''
  const ascii = String(phone).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  return ascii.replace(/\D/g, '')
}

function makePersonKey(name, phone) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  const p = normalizePhone(phone)
  return `${n}|${p}`
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

  let name
  let rows
  try {
    const body = JSON.parse(event.body || '{}')
    name = typeof body.name === 'string' ? body.name.trim() : ''
    rows = Array.isArray(body.rows) ? body.rows : null
  } catch {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'درخواست نامعتبر است' }),
    }
  }

  if (!name) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'نام قرعه‌کشی الزامی است' }),
    }
  }

  if (!rows || rows.length === 0) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'لیست شرکت‌کنندگان خالی است' }),
    }
  }

  const raffleId = randomUUID()
  const createdAt = new Date().toISOString()

  const entries = rows.map((row, index) => {
    const entryName = String(row.name ?? '').trim()
    const phone = row.phone != null ? String(row.phone).trim() : ''
    return {
      id: randomUUID(),
      personKey: makePersonKey(entryName, phone),
      name: entryName,
      phone,
      rowIndex: typeof row.rowIndex === 'number' ? row.rowIndex : index + 1,
    }
  })

  const raffle = {
    id: raffleId,
    name,
    status: 'draft',
    createdAt,
    entries,
    prizes: [],
    excludedPersonKeys: [],
    winners: [],
  }

  const store = await getDataStore(event)

  await store.setJSON(`raffles/${raffleId}.json`, raffle)

  let index = []
  try {
    const existing = await store.get('raffles/index.json', { type: 'json' })
    if (Array.isArray(existing)) index = existing
  } catch {
    index = []
  }

  index.unshift({
    id: raffleId,
    name,
    createdAt,
    status: 'draft',
  })

  await store.setJSON('raffles/index.json', index)

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({
      raffleId,
      name,
      entryCount: entries.length,
      status: 'draft',
    }),
  }
}
