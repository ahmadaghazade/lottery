import { useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion, useMotionValue, useTransform } from 'framer-motion'
import confetti from 'canvas-confetti'

const ITEM_HEIGHT = 64
const VISIBLE_ROWS = 7
const VIEWPORT_HEIGHT = ITEM_HEIGHT * VISIBLE_ROWS
const CENTER_OFFSET = ((VISIBLE_ROWS - 1) / 2) * ITEM_HEIGHT
const SPIN_DURATION = 2.25

function shuffleArray(items) {
  const arr = [...items]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

/**
 * Build a wheel list that stops ON the winner, with more names after it
 * so the picker still shows rows below center (doesn't feel like list end).
 */
export function buildSpinSequence(eligibleNames, winnerName) {
  const pool = eligibleNames?.length ? eligibleNames : [winnerName]
  const shuffled = shuffleArray(pool)
  const loops = 1.5 + Math.random() * 0.5
  const fullLoops = Math.floor(loops)
  const before = []

  for (let i = 0; i < fullLoops; i++) {
    before.push(...shuffled)
  }

  const fraction = loops - fullLoops
  if (fraction > 0.05) {
    before.push(...shuffled.slice(0, Math.max(1, Math.round(shuffled.length * fraction))))
  }

  while (before.length < 18) {
    before.push(...shuffleArray(pool))
  }

  // Names after the winner fill the lower half of the picker (≈3–5 visible rows)
  const afterCount = Math.max(4, Math.ceil(VISIBLE_ROWS / 2) + 1)
  const after = []
  while (after.length < afterCount) {
    const batch = shuffleArray(pool.filter((n) => n !== winnerName))
    if (!batch.length) {
      after.push(...shuffleArray(pool))
    } else {
      after.push(...batch)
    }
  }

  const sequence = [...before, winnerName, ...after.slice(0, afterCount)]
  const stopIndex = before.length
  return { sequence, stopIndex }
}

/** Fast blur-through for ~80–85% of time, short visible decelerate at the end. */
function spinEase(t) {
  const split = 0.82
  if (t <= split) {
    return (0.94 * t) / split
  }
  const u = (t - split) / (1 - split)
  // ease-out on the final 6% of distance
  return 0.94 + 0.06 * (1 - (1 - u) ** 2.4)
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

function WheelRow({ index, name, y }) {
  const opacity = useTransform(y, (latest) => {
    const itemCenter = index * ITEM_HEIGHT + latest + ITEM_HEIGHT / 2
    const viewportCenter = VIEWPORT_HEIGHT / 2
    const dist = Math.abs(itemCenter - viewportCenter) / ITEM_HEIGHT
    if (dist < 0.45) return 1
    if (dist < 1.35) return 0.55
    if (dist < 2.35) return 0.25
    return 0.08
  })

  const filter = useTransform(y, (latest) => {
    const itemCenter = index * ITEM_HEIGHT + latest + ITEM_HEIGHT / 2
    const viewportCenter = VIEWPORT_HEIGHT / 2
    const dist = Math.abs(itemCenter - viewportCenter) / ITEM_HEIGHT
    if (dist < 0.45) return 'blur(0px)'
    if (dist < 1.35) return 'blur(1.5px)'
    if (dist < 2.35) return 'blur(3.5px)'
    return 'blur(6px)'
  })

  const scale = useTransform(y, (latest) => {
    const itemCenter = index * ITEM_HEIGHT + latest + ITEM_HEIGHT / 2
    const viewportCenter = VIEWPORT_HEIGHT / 2
    const dist = Math.abs(itemCenter - viewportCenter) / ITEM_HEIGHT
    if (dist < 0.45) return 1.08
    if (dist < 1.35) return 0.94
    if (dist < 2.35) return 0.86
    return 0.8
  })

  return (
    <motion.div
      className="flex items-center justify-center px-4 text-center font-semibold will-change-transform"
      style={{
        height: ITEM_HEIGHT,
        opacity,
        filter,
        scale,
      }}
    >
      <span className="max-w-full truncate text-2xl text-white sm:text-3xl">{name}</span>
    </motion.div>
  )
}

function PickerWheel({ sequence, stopIndex, onComplete }) {
  const y = useMotionValue(CENTER_OFFSET)
  const startY = CENTER_OFFSET
  const endY = CENTER_OFFSET - stopIndex * ITEM_HEIGHT
  const finished = useRef(false)

  useEffect(() => {
    finished.current = false
    y.set(startY)
  }, [sequence, stopIndex, startY, y])

  return (
    <div className="relative mx-auto w-full max-w-xl">
      <div
        className="relative overflow-hidden rounded-[1.75rem] border border-amber-300/25 bg-stone-950/50 shadow-[0_0_60px_rgba(251,191,36,0.12)]"
        style={{
          height: VIEWPORT_HEIGHT,
          WebkitMaskImage:
            'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
          maskImage:
            'linear-gradient(to bottom, transparent 0%, black 18%, black 82%, transparent 100%)',
        }}
      >
        {/* Fixed center selection band */}
        <div
          className="pointer-events-none absolute inset-x-3 z-20 rounded-xl border border-amber-300/70 bg-amber-400/10 shadow-[0_0_28px_rgba(251,191,36,0.28)]"
          style={{
            top: CENTER_OFFSET,
            height: ITEM_HEIGHT,
          }}
        />
        <div
          className="pointer-events-none absolute inset-x-8 z-20 border-t border-amber-200/50"
          style={{ top: CENTER_OFFSET }}
        />
        <div
          className="pointer-events-none absolute inset-x-8 z-20 border-b border-amber-200/50"
          style={{ top: CENTER_OFFSET + ITEM_HEIGHT }}
        />

        <motion.div
          className="relative z-10 will-change-transform"
          style={{ y }}
          initial={{ y: startY }}
          animate={{ y: endY }}
          transition={{
            duration: SPIN_DURATION,
            ease: spinEase,
          }}
          onAnimationComplete={() => {
            if (finished.current) return
            finished.current = true
            onComplete?.()
          }}
        >
          {sequence.map((name, index) => (
            <WheelRow key={`${index}-${name}`} index={index} name={name} y={y} />
          ))}
        </motion.div>
      </div>
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

  const spinPlan = useMemo(
    () => buildSpinSequence(eligibleNames, winner?.name || 'برنده'),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [winner?.id, winner?.name],
  )

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
        schedule(() => setStage('slot'), 650)
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

          {stage === 'slot' ? (
            <motion.div
              key="slot"
              className="w-full max-w-3xl"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
            >
              <p className="mb-5 text-center text-sm font-semibold tracking-wide text-amber-300/90">
                {winner.prizeName}
              </p>
              <PickerWheel
                sequence={spinPlan.sequence}
                stopIndex={spinPlan.stopIndex}
                onComplete={enterReveal}
              />
              <p className="mt-5 text-center text-xs text-stone-400">چرخ در حال چرخش…</p>
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
