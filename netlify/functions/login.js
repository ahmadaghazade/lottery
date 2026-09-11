import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { jsonHeaders, handleOptions } from './utils/auth.js'

export async function handler(event) {
  if (event.httpMethod === 'OPTIONS') return handleOptions()

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'متد مجاز نیست' }),
    }
  }

  const adminEmail = process.env.ADMIN_EMAIL
  const passwordHash = process.env.ADMIN_PASSWORD_HASH
  const jwtSecret = process.env.JWT_SECRET

  if (!adminEmail || !passwordHash || !jwtSecret) {
    return {
      statusCode: 500,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'پیکربندی سرور ناقص است' }),
    }
  }

  let email
  let password
  try {
    const body = JSON.parse(event.body || '{}')
    email = typeof body.email === 'string' ? body.email.trim() : ''
    password = typeof body.password === 'string' ? body.password : ''
  } catch {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'درخواست نامعتبر است' }),
    }
  }

  if (!email || !password) {
    return {
      statusCode: 400,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'ایمیل و رمز عبور الزامی است' }),
    }
  }

  const emailMatches = email.toLowerCase() === adminEmail.toLowerCase()
  const passwordMatches = emailMatches && (await bcrypt.compare(password, passwordHash))

  if (!passwordMatches) {
    return {
      statusCode: 401,
      headers: jsonHeaders,
      body: JSON.stringify({ error: 'ایمیل یا رمز عبور اشتباه است' }),
    }
  }

  const token = jwt.sign({ email: adminEmail }, jwtSecret, { expiresIn: '12h' })

  return {
    statusCode: 200,
    headers: jsonHeaders,
    body: JSON.stringify({ token, email: adminEmail }),
  }
}
