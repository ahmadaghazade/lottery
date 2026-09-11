import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { toPersianDigits } from '../lib/parseExcel'

const STATUS_LABELS = {
  draft: 'پیش‌نویس',
  ready: 'آماده قرعه‌کشی',
  drawing: 'در حال قرعه‌کشی',
  completed: 'پایان‌یافته',
}

export default function AdminHomePage() {
  const { token } = useAuth()
  const [raffles, setRaffles] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [deletingId, setDeletingId] = useState(null)
  const [confirmRaffle, setConfirmRaffle] = useState(null)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setError('')
      try {
        const res = await fetch('/api/list-raffles', {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setError(data.error || 'بارگذاری فهرست ناموفق بود')
          return
        }
        if (!cancelled) setRaffles(Array.isArray(data.raffles) ? data.raffles : [])
      } catch {
        if (!cancelled) setError('ارتباط با سرور برقرار نشد')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [token])

  useEffect(() => {
    if (!confirmRaffle) return undefined
    function onKeyDown(e) {
      if (e.key === 'Escape' && !deletingId) setConfirmRaffle(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [confirmRaffle, deletingId])

  async function confirmDelete() {
    if (!confirmRaffle) return
    const raffle = confirmRaffle

    setDeletingId(raffle.id)
    setError('')
    try {
      const res = await fetch('/api/delete-raffle', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ raffleId: raffle.id }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data.error || 'حذف ناموفق بود')
        return
      }
      setRaffles((prev) => prev.filter((item) => item.id !== raffle.id))
      setConfirmRaffle(null)
    } catch {
      setError('ارتباط با سرور برقرار نشد')
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-stone-200 bg-white p-8 shadow-sm">
        <h1 className="text-2xl font-bold text-stone-900">پنل مدیریت</h1>
        <p className="mt-2 max-w-xl text-stone-600">
          قرعه‌کشی بسازید، جوایز را تنظیم کنید و قرعه‌کشی زنده را اجرا کنید.
        </p>
        <Link
          to="/admin/raffles/new"
          className="mt-6 inline-flex rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800"
        >
          قرعه‌کشی جدید
        </Link>
      </div>

      <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <h2 className="text-lg font-semibold text-stone-900">قرعه‌کشی‌ها</h2>

        {loading ? <p className="mt-4 text-sm text-stone-500">در حال بارگذاری…</p> : null}
        {error ? (
          <p className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {error}
          </p>
        ) : null}

        {!loading && !error && raffles.length === 0 ? (
          <p className="mt-4 text-sm text-stone-500">هنوز قرعه‌کشی‌ای ساخته نشده است.</p>
        ) : null}

        {!loading && raffles.length > 0 ? (
          <ul className="mt-4 divide-y divide-stone-100">
            {raffles.map((raffle) => {
              const canDraw =
                raffle.status === 'ready' ||
                raffle.status === 'drawing' ||
                raffle.status === 'completed'
              return (
                <li key={raffle.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                  <div>
                    <p className="font-medium text-stone-900">{raffle.name}</p>
                    <p className="mt-0.5 text-xs text-stone-500">
                      {STATUS_LABELS[raffle.status] || raffle.status}
                      {raffle.createdAt ? (
                        <>
                          <span className="mx-1.5 text-stone-300">·</span>
                          <span dir="ltr">{new Date(raffle.createdAt).toLocaleString('fa-IR')}</span>
                        </>
                      ) : null}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Link
                      to={`/admin/raffles/${raffle.id}`}
                      className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
                    >
                      جوایز
                    </Link>
                    {canDraw ? (
                      <>
                        <Link
                          to={`/admin/raffles/${raffle.id}/draw`}
                          className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
                        >
                          {raffle.status === 'completed' ? 'نتایج ادمین' : 'قرعه‌کشی ادمین'}
                        </Link>
                        <Link
                          to={`/live/${raffle.id}`}
                          className="rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
                        >
                          صفحه عمومی
                        </Link>
                      </>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => setConfirmRaffle(raffle)}
                      disabled={Boolean(deletingId)}
                      className="rounded-xl border border-rose-200 bg-white px-3.5 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      حذف
                    </button>
                  </div>
                </li>
              )
            })}
          </ul>
        ) : null}

        {!loading && raffles.length > 0 ? (
          <p className="mt-2 text-xs text-stone-400">{toPersianDigits(raffles.length)} مورد</p>
        ) : null}
      </div>

      {confirmRaffle ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-stone-950/45 px-4 backdrop-blur-[2px]"
          role="presentation"
          onClick={() => {
            if (!deletingId) setConfirmRaffle(null)
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-raffle-title"
            className="w-full max-w-md rounded-2xl border border-stone-200 bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 id="delete-raffle-title" className="text-lg font-bold text-stone-900">
              حذف قرعه‌کشی؟
            </h3>
            <p className="mt-2 text-sm leading-6 text-stone-600">
              قرعه‌کشی «{confirmRaffle.name}» برای همیشه حذف می‌شود. شرکت‌کنندگان، جوایز و برندگان هم پاک
              می‌شوند و این کار قابل بازگشت نیست.
            </p>
            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmRaffle(null)}
                disabled={Boolean(deletingId)}
                className="rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50 disabled:opacity-60"
              >
                انصراف
              </button>
              <button
                type="button"
                onClick={confirmDelete}
                disabled={Boolean(deletingId)}
                className="rounded-xl bg-rose-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-rose-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {deletingId === confirmRaffle.id ? 'در حال حذف…' : 'بله، حذف شود'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
