import { useEffect, useState } from 'react'
import { Link, Navigate, Outlet, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'

export default function ProtectedAdmin() {
  const { token, email, logout } = useAuth()
  const navigate = useNavigate()
  const [status, setStatus] = useState('checking')

  useEffect(() => {
    let cancelled = false

    async function verify() {
      if (!token) {
        if (!cancelled) setStatus('invalid')
        return
      }

      try {
        const res = await fetch('/api/verify-session', {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (!cancelled) setStatus(res.ok ? 'valid' : 'invalid')
      } catch {
        if (!cancelled) setStatus('invalid')
      }
    }

    verify()
    return () => {
      cancelled = true
    }
  }, [token])

  if (status === 'checking') {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-100 text-stone-600">
        در حال بررسی نشست…
      </div>
    )
  }

  if (status === 'invalid') {
    return <Navigate to="/login" replace />
  }

  function handleLogout() {
    logout()
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen bg-stone-100 text-stone-900">
      <header className="border-b border-stone-200/80 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <Link
              to="/admin"
              className="flex h-9 w-9 items-center justify-center rounded-xl bg-teal-700 text-sm font-bold text-white shadow-sm shadow-teal-700/25"
            >
              ق
            </Link>
            <div>
              <Link to="/admin" className="text-sm font-semibold text-stone-900 hover:text-teal-800">
                Raffle App
              </Link>
              <p className="text-xs text-stone-500">{email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 transition hover:border-stone-300 hover:bg-stone-50"
          >
            خروج
          </button>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <Outlet />
      </main>
    </div>
  )
}
