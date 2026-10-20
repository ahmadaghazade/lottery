import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useMotionValue, useTransform } from 'framer-motion'
import confetti from 'canvas-confetti'

const MAX_WHEEL_SLICES = 16
const MIN_WHEEL_SLICES = 8
const SLICE_COLORS = ['#9a3412', '#0f766e', '#b45309', '#115e59', '#c2410c', '#0e7490', '#d97706', '#134e4a']

function shuffleArray(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Slices for a fortune wheel. The wheel always stops on winnerIndex.
 * Long lists are sampled down to MAX_WHEEL_SLICES so each name stays readable.
 * The predetermined winner is always one of the slices.
 */
function buildWheelSlices(eligibleNames, winnerName) {
  const winner = String(winnerName || 'برنده')
  const names = (eligibleNames || []).map((name) => String(name || '').trim()).filter(Boolean)
  let slices = names.length ? [...names] : [winner]

  if (!slices.includes(winner)) slices = [winner, ...slices]

  if (slices.length > MAX_WHEEL_SLICES) {
    const others = shuffleArray(slices.filter((name) => name !== winner))
    slices = shuffleArray([winner, ...others.slice(0, MAX_WHEEL_SLICES - 1)])
  }

  if (slices.length < MIN_WHEEL_SLICES) {
    const fillers = slices.filter((name) => name !== winner)
    if (!fillers.length) {
      slices = Array.from({ length: MIN_WHEEL_SLICES }, () => winner)
    } else {
      let index = 0
      while (slices.length < MIN_WHEEL_SLICES) {
        slices.push(fillers[index % fillers.length])
        index += 1
      }
    }
  }

  const winnerIndex = Math.max(0, slices.indexOf(winner))
  return { slices, winnerIndex }
}

/** Fast spin, then a long ease-out so the pointer settles on the winner. */
function wheelEase(t) {
  return 1 - (1 - t) ** 3.2
}

function polar(angleDeg, radius) {
  const rad = ((angleDeg - 90) * Math.PI) / 180
  return [50 + radius * Math.cos(rad), 50 + radius * Math.sin(rad)]
}

function slicePath(index, count, radius) {
  const sweep = 360 / count
  const start = index * sweep
  const end = start + sweep
  const large = sweep > 180 ? 1 : 0
  const [x1, y1] = polar(start, radius)
  const [x2, y2] = polar(end, radius)
  return `M 50 50 L ${x1} ${y1} A ${radius} ${radius} 0 ${large} 1 ${x2} ${y2} Z`
}

function shortenName(name, count) {
  const max = count <= 8 ? 16 : count <= 12 ? 13 : 10
  const value = String(name || '')
  if (value.length <= max) return value
  return `${value.slice(0, max - 1)}…`
}

function nameAtRotation(deg, slices) {
  const sweep = 360 / slices.length
  const normalized = (((-deg) % 360) + 360) % 360
  const index = Math.min(slices.length - 1, Math.floor(normalized / sweep + 1e-6))
  return slices[index] || ''
}

function fireWinnerConfetti() {
  const gold = ['#fbbf24', '#f59e0b', '#fde68a', '#fcd34d', '#ffffff', '#2dd4bf']
  confetti({
    particleCount: 90,
    spread: 78,
    startVelocity: 48,
    origin: { x: 0.5, y: 0.72 },
    colors: gold,
    disableForReducedMotion: true,
  })
  confetti({
    particleCount: 55,
    angle: 60,
    spread: 55,
    origin: { x: 0.15, y: 0.75 },
    colors: gold,
    disableForReducedMotion: true,
  })
  confetti({
    particleCount: 55,
    angle: 120,
    spread: 55,
    origin: { x: 0.85, y: 0.75 },
    colors: gold,
    disableForReducedMotion: true,
  })
}

function AmbientBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_50%_-10%,rgba(251,191,36,0.28),transparent_50%),radial-gradient(ellipse_at_20%_80%,rgba(13,148,136,0.35),transparent_45%),radial-gradient(ellipse_at_85%_40%,rgba(180,83,9,0.22),transparent_40%),linear-gradient(165deg,#070605_0%,#0f2926_45%,#1c1408_100%)]" />
      <motion.div
        className="absolute -right-24 top-1/4 h-[28rem] w-[28rem] rounded-full bg-amber-400/15 blur-3xl"
        animate={{ x: [0, -40, 20, 0], y: [0, 30, -20, 0], scale: [1, 1.08, 0.96, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -left-20 bottom-0 h-[24rem] w-[24rem] rounded-full bg-teal-500/20 blur-3xl"
        animate={{ x: [0, 35, -15, 0], y: [0, -25, 15, 0], scale: [1, 0.94, 1.06, 1] }}
        transition={{ duration: 16, repeat: Infinity, ease: 'easeInOut' }}
      />
      {Array.from({ length: 18 }).map((_, i) => (
        <motion.span
          key={i}
          className="absolute h-1 w-1 rounded-full bg-amber-200/70"
          style={{
            left: `${(i * 17) % 100}%`,
            top: `${(i * 29) % 100}%`,
          }}
          animate={{ opacity: [0.15, 0.85, 0.15], y: [0, -18, 0] }}
          transition={{ duration: 3.5 + (i % 5), repeat: Infinity, delay: i * 0.2, ease: 'easeInOut' }}
        />
      ))}
    </div>
  )
}

function FortuneWheel({ names, winnerName, onComplete }) {
  const { slices, winnerIndex } = useMemo(
    () => buildWheelSlices(names, winnerName),
    [names, winnerName],
  )

  const rotation = useMotionValue(0)
  const activeName = useTransform(rotation, (deg) => nameAtRotation(deg, slices))
  const [landed, setLanded] = useState(false)
  const finished = useRef(false)
  const onCompleteRef = useRef(onComplete)

  useEffect(() => {
    onCompleteRef.current = onComplete
  }, [onComplete])

  useEffect(() => {
    const sweep = 360 / slices.length
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const turns = reduceMotion ? 1 : 6
    const jitter = reduceMotion ? 0 : (Math.random() - 0.5) * sweep * 0.36
    const end = turns * 360 - ((winnerIndex + 0.5) * sweep + jitter)
    const duration = reduceMotion ? 0.35 : 7

    finished.current = false
    rotation.set(0)
    let timeoutId
    let cancelled = false
    const controls = animate(rotation, end, {
      duration,
      ease: wheelEase,
      onComplete: () => {
        if (cancelled || finished.current) return
        finished.current = true
        setLanded(true)
        timeoutId = setTimeout(() => onCompleteRef.current?.(), 1200)
      },
    })
    return () => {
      cancelled = true
      controls.stop()
      clearTimeout(timeoutId)
    }
  }, [rotation, slices.length, winnerIndex])

  const showLabels = slices.length <= 16
  const fontSize = slices.length <= 8 ? 3.6 : slices.length <= 12 ? 3.05 : 2.55
  const highlight = slicePath(0, slices.length, 44.2)

  return (
    <div className="mx-auto w-[min(92vw,68vh,540px)]">
      <div className="relative aspect-square w-full">
        <div className="absolute left-1/2 top-[1.5%] z-30 -translate-x-1/2">
          <div className="h-0 w-0 border-x-[13px] border-t-[24px] border-x-transparent border-t-amber-300 drop-shadow-[0_6px_8px_rgba(0,0,0,0.5)]" />
        </div>

        <motion.div className="absolute inset-[5%] will-change-transform" style={{ rotate: rotation }}>
          <svg viewBox="0 0 100 100" className="h-full w-full drop-shadow-[0_16px_36px_rgba(0,0,0,0.5)]">
            <circle cx="50" cy="50" r="49" fill="#1c1408" />
            {Array.from({ length: 28 }).map((_, index) => {
              const [x, y] = polar((index / 28) * 360, 47.15)
              return (
                <circle
                  key={index}
                  cx={x}
                  cy={y}
                  r="1.05"
                  fill={index % 2 ? '#fff7ed' : '#fde68a'}
                  className={index % 2 ? 'wheel-bulb wheel-bulb-delay' : 'wheel-bulb'}
                />
              )
            })}
            {slices.map((name, index) => (
              <path
                key={`${index}-${name}`}
                d={slicePath(index, slices.length, 44.2)}
                fill={SLICE_COLORS[index % SLICE_COLORS.length]}
                stroke="rgba(253,230,138,0.28)"
                strokeWidth="0.2"
              />
            ))}
            {showLabels
              ? slices.map((name, index) => {
                  const mid = (index + 0.5) * (360 / slices.length)
                  const flip = mid > 90 && mid < 270
                  return (
                    <g key={`label-${index}`} transform={`rotate(${mid} 50 50)`}>
                      <text
                        x="50"
                        y="23"
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fill="#fff7ed"
                        fontSize={fontSize}
                        fontWeight="700"
                        stroke="#1c1917"
                        strokeWidth="0.18"
                        paintOrder="stroke"
                        transform={flip ? 'rotate(180 50 23)' : undefined}
                        style={{ fontFamily: 'Vazirmatn, sans-serif', unicodeBidi: 'plaintext' }}
                      >
                        {shortenName(name, slices.length)}
                      </text>
                    </g>
                  )
                })
              : null}
            <circle cx="50" cy="50" r="44.2" fill="none" stroke="#fbbf24" strokeWidth="1.15" />
            <circle cx="50" cy="50" r="12" fill="#1c1917" stroke="#fbbf24" strokeWidth="0.7" />
          </svg>
        </motion.div>

        {landed ? (
          <svg className="pointer-events-none absolute inset-[5%] z-10" viewBox="0 0 100 100">
            <path d={highlight} fill="rgba(251,191,36,0.28)" />
          </svg>
        ) : null}

        <div className="pointer-events-none absolute left-1/2 top-1/2 z-20 flex h-[16%] w-[16%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-gradient-to-b from-amber-200 to-amber-500 text-lg font-bold text-stone-950 shadow-[0_0_22px_rgba(251,191,36,0.55)]">
          ★
        </div>
      </div>

      <div
        className={`mx-auto mt-4 max-w-md rounded-2xl border px-4 py-3 text-center ${
          landed
            ? 'border-amber-300 bg-amber-400/15 shadow-[0_0_28px_rgba(251,191,36,0.35)]'
            : 'border-white/10 bg-stone-950/55'
        }`}
      >
        <motion.p dir="auto" className="truncate text-2xl font-bold text-white sm:text-3xl">
          {activeName}
        </motion.p>
      </div>
      <p className="mt-3 text-center text-xs text-stone-400">
        {landed ? 'برنده مشخص شد' : 'گردونه در حال چرخش…'}
      </p>
    </div>
  )
}

/**
 * Cinematic single-prize reveal for live Instagram draws.
 * Winner must already be determined server-side before mount / start.
 */
export default function DrawReveal({
  eligibleNames = [],
  winner,
  onNext,
  onDone,
  hasNext = false,
  autoStart = true,
}) {
  const [stage, setStage] = useState(autoStart ? 'countdown' : 'idle')
  const [count, setCount] = useState(3)
  const [showNext, setShowNext] = useState(false)
  const confettiFired = useRef(false)
  const timers = useRef([])

  function clearTimers() {
    timers.current.forEach((id) => clearTimeout(id))
    timers.current = []
  }

  function schedule(fn, ms) {
    const id = setTimeout(fn, ms)
    timers.current.push(id)
    return id
  }

  useEffect(() => {
    if (!winner) return undefined
    clearTimers()
    confettiFired.current = false
    setShowNext(false)

    if (!autoStart) {
      setStage('idle')
      return undefined
    }

    setStage('countdown')
    setCount(3)

    let n = 3
    const tick = () => {
      if (n > 1) {
        schedule(() => {
          n -= 1
          setCount(n)
          tick()
        }, 720)
      } else {
        schedule(() => setStage('wheel'), 650)
      }
    }
    tick()

    return clearTimers
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [winner?.id, autoStart])

  function enterReveal() {
    setStage('reveal')
    if (!confettiFired.current) {
      confettiFired.current = true
      fireWinnerConfetti()
      schedule(() => fireWinnerConfetti(), 280)
    }
    schedule(() => setShowNext(true), 1000)
  }

  if (!winner) return null

  const displayPhone = winner.phoneMasked || winner.phone || ''

  return (
    <div className="relative flex min-h-screen flex-col overflow-hidden text-white">
      <AmbientBackground />

      <div className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-10">
        <AnimatePresence mode="wait">
          {stage === 'countdown' ? (
            <motion.div
              key={`count-${count}`}
              className="relative flex items-center justify-center"
              initial={{ scale: 0.4, opacity: 0 }}
              animate={{ scale: [0.4, 1.18, 1], opacity: [0, 1, 1] }}
              exit={{ scale: 1.35, opacity: 0 }}
              transition={{ duration: 0.55, times: [0, 0.55, 1], ease: 'easeOut' }}
            >
              <motion.div
                className="absolute h-48 w-48 rounded-full border-2 border-amber-300/50 sm:h-64 sm:w-64"
                animate={{ scale: [1, 1.25, 1], opacity: [0.7, 0.15, 0.7] }}
                transition={{ duration: 0.7, repeat: Infinity, ease: 'easeInOut' }}
              />
              <motion.div
                className="absolute h-40 w-40 rounded-full bg-amber-400/20 blur-2xl sm:h-52 sm:w-52"
                animate={{ opacity: [0.35, 0.8, 0.35], scale: [0.9, 1.1, 0.9] }}
                transition={{ duration: 0.7, repeat: Infinity }}
              />
              <span className="relative text-[7.5rem] font-bold leading-none text-amber-300 drop-shadow-[0_0_40px_rgba(251,191,36,0.55)] sm:text-[10rem]">
                {count}
              </span>
            </motion.div>
          ) : null}

          {stage === 'wheel' ? (
            <motion.div
              key="wheel"
              className="flex w-full flex-col items-center"
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.25 }}
            >
              <p className="mb-2 text-center text-sm font-semibold tracking-wide text-amber-300/90">
                {winner.prizeName}
              </p>
              <FortuneWheel
                names={eligibleNames}
                winnerName={winner.name || 'برنده'}
                onComplete={enterReveal}
              />
            </motion.div>
          ) : null}

          {stage === 'reveal' ? (
            <motion.div
              key="reveal"
              className="w-full max-w-xl"
              initial={{ opacity: 0, scale: 0.82, y: 24 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ type: 'spring', stiffness: 260, damping: 18 }}
            >
              <p className="mb-4 text-center text-sm font-semibold text-amber-300">برنده {winner.prizeName}</p>

              <div className="relative rounded-[2rem] p-[2px]">
                <motion.div
                  className="absolute inset-0 rounded-[2rem] bg-[conic-gradient(from_120deg,#fbbf24,#f59e0b,#2dd4bf,#fde68a,#fbbf24)] opacity-90"
                  animate={{ rotate: [0, 360] }}
                  transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                />
                <motion.div
                  className="relative overflow-hidden rounded-[2rem] bg-stone-950/95 px-8 py-10 text-center shadow-2xl"
                  animate={{
                    boxShadow: [
                      '0 0 30px rgba(251,191,36,0.25)',
                      '0 0 55px rgba(251,191,36,0.5)',
                      '0 0 30px rgba(251,191,36,0.25)',
                    ],
                  }}
                  transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                >
                  <motion.div
                    className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/2 bg-gradient-to-r from-transparent via-white/10 to-transparent"
                    animate={{ x: ['0%', '280%'] }}
                    transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut', repeatDelay: 0.6 }}
                  />
                  <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-400/15 text-3xl text-amber-300">
                    ★
                  </div>
                  <p className="text-xs font-semibold tracking-[0.25em] text-teal-200">WINNER</p>
                  <h2 className="mt-3 text-4xl font-bold leading-tight text-white sm:text-5xl">{winner.name}</h2>
                  {displayPhone ? (
                    <p className="mt-4 font-mono text-lg text-stone-300" dir="ltr">
                      {displayPhone}
                    </p>
                  ) : null}
                  <p className="mt-5 inline-flex rounded-full border border-amber-300/30 bg-amber-400/10 px-4 py-1.5 text-sm font-medium text-amber-200">
                    {winner.prizeName}
                  </p>
                </motion.div>
              </div>

              <AnimatePresence>
                {showNext && hasNext && typeof onNext === 'function' ? (
                  <motion.div
                    className="mt-8 flex justify-center"
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0 }}
                  >
                    <button
                      type="button"
                      onClick={onNext}
                      className="rounded-2xl bg-amber-400 px-8 py-3.5 text-base font-bold text-stone-950 shadow-lg shadow-amber-400/30 transition hover:bg-amber-300"
                    >
                      برنده بعدی
                    </button>
                  </motion.div>
                ) : null}
                {showNext && !hasNext ? (
                  <motion.div
                    className="mt-8 flex flex-col items-center gap-3"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                  >
                    <p className="text-sm text-stone-300">همه جوایز اهدا شد</p>
                    {typeof onDone === 'function' ? (
                      <button
                        type="button"
                        onClick={onDone}
                        className="rounded-2xl border border-white/20 bg-white/10 px-6 py-3 text-sm font-semibold text-white hover:bg-white/15"
                      >
                        بازگشت به صحنه
                      </button>
                    ) : null}
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </motion.div>
          ) : null}
        </AnimatePresence>
      </div>
    </div>
  )
}
