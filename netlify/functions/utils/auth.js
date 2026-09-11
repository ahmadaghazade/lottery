import jwt from 'jsonwebtoken'

/**
 * Extract and verify a Bearer JWT from the Authorization header.
 * @returns {{ ok: true, payload: object } | { ok: false, statusCode: number, body: string }}
 */
export function verifyAuth(event) {
  const header = event.headers?.authorization || event.headers?.Authorization || ''
  const match = header.match(/^Bearer\s+(.+)$/i)

  if (!match) {
    return {
      ok: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'توکن احراز هویت موجود نیست' }),
    }
  }

  const secret = process.env.JWT_SECRET
  if (!secret) {
    return {
      ok: false,
      statusCode: 500,
      body: JSON.stringify({ error: 'پیکربندی سرور ناقص است' }),
    }
  }

  try {
    const payload = jwt.verify(match[1], secret)
    return { ok: true, payload }
  } catch {
    return {
      ok: false,
      statusCode: 401,
      body: JSON.stringify({ error: 'نشست نامعتبر یا منقضی شده است' }),
    }
  }
}

export const jsonHeaders = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
}

export function handleOptions() {
  return { statusCode: 204, headers: jsonHeaders, body: '' }
}
