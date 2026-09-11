import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import { useAuth } from '../auth/AuthContext'
import DrawReveal from '../components/DrawReveal'
import { toPersianDigits } from '../lib/parseExcel'

function maskPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '')
  if (digits.length < 7) return ''
  return `${digits.slice(0, 4)}***${digits.slice(-3)}`
}

function toPublicWinner(winner) {
  return {
    id: winner.id,
    prizeId: winner.prizeId,
    prizeName: winner.prizeName,
    name: winner.name,
    phone: winner.phone || '',
    phoneMasked: winner.phoneMasked || maskPhone(winner.phone),
    drawnAt: winner.drawnAt,
  }
}

export default function PublicLivePage() {
  const { raffleId } = useParams()
  const { token, isAuthenticated } = useAuth()
  const [raffle, setRaffle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [drawError, setDrawError] = useState('')
  const [busy, setBusy] = useState(false)
  const [session, setSession] = useState(null)
  const knownWinnerCount = useRef(0)
  const pollTimer = useRef(null)

  async function fetchPublic() {
    const res = await fetch(`/api/get-public-raffle?id=${encodeURIComponent(raffleId)}`)
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || 'بارگذاری ناموفق بود')
    return data
  }

  function applyDrawResult(data, spinFallback = []) {
    const winner = toPublicWinner(data.winner)
    knownWinnerCount.current = data.winnerCount
    setRaffle((prev) =>
      prev
        ? {
            ...prev,
            status: data.status,
            winners: [...(prev.winners || []), winner],
            winnerCount: data.winnerCount,
            remainingTickets: data.remainingTickets,
            remainingPeople: data.remainingPeople,
            nextPrize: data.nextPrize,
            completed: data.completed,
            prizes: (prev.prizes || []).map((p) =>
              p.id === winner.prizeId ? { ...p, drawnCount: (p.drawnCount || 0) + 1 } : p,
            ),
          }
        : prev,
    )
    setSession({
      winner,
      spinNames: data.spinNames?.length ? data.spinNames : spinFallback,
    })
  }

  useEffect(() => {
    let cancelled = false

    async function boot() {
      setLoading(true)
      setError('')
      try {
        const data = await fetchPublic()
        if (cancelled) return
        knownWinnerCount.current = data.winners?.length || 0
        setRaffle(data)
      } catch (err) {
        if (!cancelled) setError(err.message || 'خطا')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    boot()

    pollTimer.current = setInterval(async () => {
      if (busy || session) return
      try {
        const data = await fetchPublic()
        if (cancelled) return
        knownWinnerCount.current = data.winners?.length || 0
        setRaffle(data)
      } catch {
        // ignore transient poll errors
      }
    }, 2000)

    return () => {
      cancelled = true
      if (pollTimer.current) clearInterval(pollTimer.current)
    }
  }, [raffleId, busy, session])

  async function startDraw(prizeId, spinFallback = [], { continueSession = false } = {}) {
    if (!token) return
    if (busy && !continueSession) return
    setBusy(true)
    setDrawError('')

    try {
      const res = await fetch('/api/draw-winner', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ raffleId, prizeId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setDrawError(data.error || 'قرعه‌کشی ناموفق بود')
        setBusy(false)
        setSession(null)
        return
      }
      applyDrawResult(data, spinFallback)
    } catch {
      setDrawError('ارتباط با سرور برقرار نشد')
      setBusy(false)
      setSession(null)
    }
  }

  function handleStartClick() {
    if (!raffle?.nextPrize) return
    startDraw(raffle.nextPrize.id, raffle.eligibleNames || [])
  }

  async function handleNextWinner() {
    try {
      const data = await fetchPublic()
      setRaffle(data)
      knownWinnerCount.current = data.winners?.length || 0
      if (data.nextPrize && token) {
        await startDraw(data.nextPrize.id, data.eligibleNames || [], { continueSession: true })
      } else {
        setSession(null)
        setBusy(false)
      }
    } catch {
      setBusy(false)
      setSession(null)
      setDrawError('بارگذاری مرحله بعد ناموفق بود')
    }
  }

  function handleDone() {
    setSession(null)
    setBusy(false)
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-950 text-stone-300">
        در حال آماده‌سازی صحنه…
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-stone-950 px-4 text-center text-stone-200">
        <p className="text-lg">{error}</p>
        <Link to="/login" className="text-sm text-amber-300 underline">
          ورود مدیر
        </Link>
      </div>
    )
  }

  const completed = raffle.completed || raffle.status === 'completed'
  const canStart = isAuthenticated && !completed && raffle.nextPrize && !session && !busy

  if (session?.winner) {
    return (
      <DrawReveal
        key={session.winner.id}
        eligibleNames={session.spinNames}
        winner={session.winner}
        hasNext={Boolean(raffle?.nextPrize) && isAuthenticated}
        onNext={handleNextWinner}
        onDone={handleDone}
        autoStart
      />
    )
  }

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden bg-stone-950 text-white">
      <div
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at 50% -10%, rgba(251,191,36,0.22), transparent 45%), radial-gradient(ellipse at 15% 85%, rgba(13,148,136,0.3), transparent 40%), linear-gradient(165deg, #070605 0%, #0f2926 50%, #1c1408 100%)',
        }}
        aria-hidden
      />
      <motion.div
        className="pointer-events-none absolute -left-20 top-1/3 h-80 w-80 rounded-full bg-teal-500/20 blur-3xl"
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 12, repeat: Infinity, ease: 'easeInOut' }}
        aria-hidden
      />

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between px-4 py-5 sm:px-6">
        <div>
          <p className="text-xs font-semibold tracking-wide text-amber-300/90">Raffle App · LIVE</p>
          <h1 className="mt-1 text-xl font-bold sm:text-2xl">{raffle.name}</h1>
        </div>
        {isAuthenticated ? (
          <Link to="/admin" className="text-xs text-stone-400 hover:text-amber-200">
            پنل مدیریت
          </Link>
        ) : null}
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-5xl flex-1 flex-col items-center justify-center px-4 pb-16 text-center sm:px-6">
        <AnimatePresence mode="wait">
          {completed ? (
            <motion.div
              key="done"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-xl"
            >
              <p className="text-sm font-medium text-amber-300">مراسم به پایان رسید</p>
              <h2 className="mt-3 text-4xl font-bold sm:text-5xl">برندگان اعلام شدند</h2>
              <p className="mt-4 text-stone-300">
                {toPersianDigits(raffle.winnerCount)} برنده از میان {toPersianDigits(raffle.entryCount)} بلیط
              </p>
            </motion.div>
          ) : (
            <motion.div
              key="ready"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              className="w-full max-w-xl"
            >
              <p className="text-sm font-medium text-amber-300">جایزه بعدی</p>
              <h2 className="mt-3 text-4xl font-bold leading-tight sm:text-5xl">{raffle.nextPrize?.name}</h2>
              <p className="mt-4 text-sm text-stone-300">
                نوبت {toPersianDigits((raffle.nextPrize?.drawnCount || 0) + 1)} از{' '}
                {toPersianDigits(raffle.nextPrize?.quantity || 1)}
                <span className="mx-2 text-stone-600">·</span>
                {toPersianDigits(raffle.remainingTickets)} بلیط
              </p>

              {drawError ? (
                <p className="mx-auto mt-6 max-w-md rounded-xl border border-rose-400/30 bg-rose-500/10 px-4 py-2 text-sm text-rose-100">
                  {drawError}
                </p>
              ) : null}

              {canStart ? (
                <button
                  type="button"
                  onClick={handleStartClick}
                  className="mt-10 rounded-2xl bg-amber-400 px-10 py-4 text-lg font-bold text-stone-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-300"
                >
                  شروع قرعه‌کشی
                </button>
              ) : (
                <p className="mt-10 text-sm text-stone-400">
                  {busy ? 'در حال آماده‌سازی…' : 'منتظر شروع قرعه‌کشی توسط مجری باشید'}
                </p>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {raffle.winners?.length ? (
          <section className="mt-14 w-full max-w-xl rounded-3xl border border-white/10 bg-white/5 p-5 text-right backdrop-blur">
            <h3 className="text-sm font-semibold text-stone-200">برندگان تا این لحظه</h3>
            <ol className="mt-3 space-y-2">
              {[...raffle.winners]
                .reverse()
                .slice(0, 8)
                .map((w) => (
                  <li key={w.id} className="flex items-center justify-between gap-3 text-sm">
                    <span className="font-medium">{w.name}</span>
                    <span className="text-xs text-amber-200/80">{w.prizeName}</span>
                  </li>
                ))}
            </ol>
          </section>
        ) : null}
      </main>
    </div>
  )
}
