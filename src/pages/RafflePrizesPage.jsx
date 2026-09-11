import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { toPersianDigits } from '../lib/parseExcel'

function emptyPrize() {
  return { key: crypto.randomUUID(), id: '', name: '', quantity: 1 }
}

const STATUS_LABELS = {
  draft: 'پیش‌نویس',
  ready: 'آماده قرعه‌کشی',
  drawing: 'در حال قرعه‌کشی',
  completed: 'پایان‌یافته',
}

export default function RafflePrizesPage() {
  const { raffleId } = useParams()
  const { token } = useAuth()
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [raffle, setRaffle] = useState(null)
  const [prizes, setPrizes] = useState([emptyPrize()])
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function load() {
      setLoading(true)
      setLoadError('')
      setSaved(false)

      try {
        const res = await fetch(`/api/get-raffle?id=${encodeURIComponent(raffleId)}`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        const data = await res.json().catch(() => ({}))
        if (!res.ok) {
          if (!cancelled) setLoadError(data.error || 'بارگذاری قرعه‌کشی ناموفق بود')
          return
        }
        if (cancelled) return

        setRaffle(data)
        if (Array.isArray(data.prizes) && data.prizes.length > 0) {
          setPrizes(
            data.prizes.map((p) => ({
              key: p.id || crypto.randomUUID(),
              id: p.id || '',
              name: p.name || '',
              quantity: p.quantity || 1,
            })),
          )
        } else {
          setPrizes([emptyPrize()])
        }
      } catch {
        if (!cancelled) setLoadError('ارتباط با سرور برقرار نشد')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    load()
    return () => {
      cancelled = true
    }
  }, [raffleId, token])

  const totalSlots = useMemo(
    () => prizes.reduce((sum, p) => sum + (Number(p.quantity) || 0), 0),
    [prizes],
  )

  function updatePrize(key, patch) {
    setSaved(false)
    setPrizes((prev) => prev.map((p) => (p.key === key ? { ...p, ...patch } : p)))
  }

  function addPrize() {
    setSaved(false)
    setPrizes((prev) => [...prev, emptyPrize()])
  }

  function removePrize(key) {
    setSaved(false)
    setPrizes((prev) => (prev.length <= 1 ? prev : prev.filter((p) => p.key !== key)))
  }

  function movePrize(key, direction) {
    setSaved(false)
    setPrizes((prev) => {
      const index = prev.findIndex((p) => p.key === key)
      if (index < 0) return prev
      const target = index + direction
      if (target < 0 || target >= prev.length) return prev
      const next = [...prev]
      const [item] = next.splice(index, 1)
      next.splice(target, 0, item)
      return next
    })
  }

  async function handleSave(e) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    setSaved(false)

    try {
      const res = await fetch('/api/save-prizes', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          raffleId,
          prizes: prizes.map(({ id, name, quantity }) => ({
            id: id || undefined,
            name,
            quantity: Number(quantity),
          })),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSaveError(data.error || 'ذخیره جوایز ناموفق بود')
        return
      }

      setPrizes(
        (data.prizes || []).map((p) => ({
          key: p.id,
          id: p.id,
          name: p.name,
          quantity: p.quantity,
        })),
      )
      setRaffle((prev) =>
        prev
          ? {
              ...prev,
              status: data.status,
              prizes: data.prizes,
              prizeCount: data.prizeCount,
            }
          : prev,
      )
      setSaved(true)
    } catch {
      setSaveError('ارتباط با سرور برقرار نشد')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="text-stone-500">در حال بارگذاری قرعه‌کشی…</p>
  }

  if (loadError) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-rose-800">
        <p>{loadError}</p>
        <Link to="/admin" className="mt-4 inline-flex text-sm font-medium underline">
          بازگشت به پنل
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-sm font-medium text-teal-700">مرحله ۲ — پیکربندی جوایز</p>
          <h1 className="mt-1 text-2xl font-bold text-stone-900">{raffle.name}</h1>
          <p className="mt-1 text-sm text-stone-500">
            {toPersianDigits(raffle.entryCount)} بلیط / {toPersianDigits(raffle.uniquePeople)} نفر
            یکتا
            <span className="mx-2 text-stone-300">·</span>
            وضعیت: {STATUS_LABELS[raffle.status] || raffle.status}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {(raffle.status === 'ready' ||
            raffle.status === 'drawing' ||
            raffle.status === 'completed') && (
            <>
              <Link
                to={`/live/${raffleId}`}
                className="rounded-xl bg-amber-500 px-3.5 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400"
              >
                صفحه عمومی
              </Link>
              <Link
                to={`/admin/raffles/${raffleId}/draw`}
                className="rounded-xl bg-teal-700 px-3.5 py-2 text-sm font-semibold text-white hover:bg-teal-800"
              >
                {raffle.status === 'completed' ? 'مشاهده نتایج' : 'شروع قرعه‌کشی'}
              </Link>
            </>
          )}
          <Link
            to="/admin"
            className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            فهرست قرعه‌کشی‌ها
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-dashed border-stone-200 bg-white px-4 py-3 text-sm text-stone-600">
        <span className="font-medium text-stone-800">raffleId:</span>{' '}
        <span className="font-mono" dir="ltr">
          {raffleId}
        </span>
      </div>

      <form onSubmit={handleSave} className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-lg font-semibold text-stone-900">جوایز</h2>
            <p className="mt-1 text-sm text-stone-500">
              ترتیب لیست، ترتیب اعلام جوایز در مرحله قرعه‌کشی خواهد بود. مجموع سهمیه‌ها:{' '}
              {toPersianDigits(totalSlots)}
            </p>
          </div>
          <button
            type="button"
            onClick={addPrize}
            className="rounded-xl border border-stone-200 bg-stone-50 px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            افزودن جایزه
          </button>
        </div>

        <ul className="space-y-3">
          {prizes.map((prize, index) => (
            <li
              key={prize.key}
              className="flex flex-col gap-3 rounded-xl border border-stone-100 bg-stone-50/70 p-4 sm:flex-row sm:items-end"
            >
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-teal-700 text-sm font-bold text-white">
                {toPersianDigits(index + 1)}
              </div>
              <div className="min-w-0 flex-1">
                <label className="mb-1 block text-xs font-medium text-stone-600">نام جایزه</label>
                <input
                  type="text"
                  required
                  value={prize.name}
                  onChange={(e) => updatePrize(prize.key, { name: e.target.value })}
                  placeholder="مثلاً: آیفون ۱۶"
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                />
              </div>
              <div className="w-full sm:w-32">
                <label className="mb-1 block text-xs font-medium text-stone-600">تعداد</label>
                <input
                  type="number"
                  min={1}
                  step={1}
                  required
                  value={prize.quantity}
                  onChange={(e) => updatePrize(prize.key, { quantity: e.target.value })}
                  className="w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 outline-none focus:border-teal-600 focus:ring-2 focus:ring-teal-600/20"
                  dir="ltr"
                />
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  title="بالا"
                  onClick={() => movePrize(prize.key, -1)}
                  disabled={index === 0}
                  className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm disabled:opacity-40"
                >
                  ↑
                </button>
                <button
                  type="button"
                  title="پایین"
                  onClick={() => movePrize(prize.key, 1)}
                  disabled={index === prizes.length - 1}
                  className="rounded-lg border border-stone-200 bg-white px-2.5 py-2 text-sm disabled:opacity-40"
                >
                  ↓
                </button>
                <button
                  type="button"
                  title="حذف"
                  onClick={() => removePrize(prize.key)}
                  disabled={prizes.length <= 1}
                  className="rounded-lg border border-rose-200 bg-white px-2.5 py-2 text-sm text-rose-700 disabled:opacity-40"
                >
                  حذف
                </button>
              </div>
            </li>
          ))}
        </ul>

        {saveError ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {saveError}
          </p>
        ) : null}

        {saved ? (
          <div className="rounded-xl border border-teal-200 bg-teal-50 px-4 py-3 text-sm text-teal-800">
            <p>جوایز ذخیره شد. وضعیت: آماده قرعه‌کشی.</p>
            <Link
              to={`/live/${raffleId}`}
              className="mt-3 ml-2 inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-stone-950 hover:bg-amber-400"
            >
              باز کردن صفحه عمومی
            </Link>
            <Link
              to={`/admin/raffles/${raffleId}/draw`}
              className="mt-3 inline-flex rounded-xl bg-teal-700 px-4 py-2 text-sm font-semibold text-white hover:bg-teal-800"
            >
              رفتن به قرعه‌کشی زنده
            </Link>
          </div>
        ) : null}

        <button
          type="submit"
          disabled={saving || raffle.status === 'drawing' || raffle.status === 'completed'}
          className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-700/20 hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? 'در حال ذخیره…' : 'ذخیره جوایز'}
        </button>
      </form>
    </div>
  )
}
