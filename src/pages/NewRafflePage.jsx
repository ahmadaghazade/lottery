import { useCallback, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthContext'
import { parseParticipantsFromFile, toPersianDigits } from '../lib/parseExcel'

const ACCEPT = '.xlsx,.xls,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel'

export default function NewRafflePage() {
  const { token } = useAuth()
  const inputRef = useRef(null)
  const [raffleName, setRaffleName] = useState('')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState(null)
  const [uniquePeople, setUniquePeople] = useState(0)
  const [parseError, setParseError] = useState('')
  const [dragOver, setDragOver] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [createdRaffleId, setCreatedRaffleId] = useState(null)

  const handleFile = useCallback(async (file) => {
    if (!file) return
    setParseError('')
    setSubmitError('')
    setCreatedRaffleId(null)
    setFileName(file.name)

    const lower = file.name.toLowerCase()
    if (!lower.endsWith('.xlsx') && !lower.endsWith('.xls')) {
      setParseError('فقط فایل‌های Excel با پسوند .xlsx یا .xls پذیرفته می‌شوند')
      setRows(null)
      return
    }

    try {
      const result = await parseParticipantsFromFile(file)
      setRows(result.rows)
      setUniquePeople(result.uniquePeople)
    } catch (err) {
      setRows(null)
      setUniquePeople(0)
      setParseError(err.message || 'خطا در خواندن فایل')
    }
  }, [])

  function onDrop(e) {
    e.preventDefault()
    setDragOver(false)
    const file = e.dataTransfer.files?.[0]
    handleFile(file)
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!rows?.length || !raffleName.trim()) return

    setSubmitting(true)
    setSubmitError('')

    try {
      const res = await fetch('/api/upload-participants', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          name: raffleName.trim(),
          rows: rows.map(({ name, phone, rowIndex }) => ({ name, phone, rowIndex })),
        }),
      })
      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setSubmitError(data.error || 'ذخیره پیش‌نویس ناموفق بود')
        return
      }

      setCreatedRaffleId(data.raffleId)
    } catch {
      setSubmitError('ارتباط با سرور برقرار نشد')
    } finally {
      setSubmitting(false)
    }
  }

  const previewRows = rows ?? []

  if (createdRaffleId) {
    return (
      <div className="rounded-2xl border border-teal-200 bg-white p-8 shadow-sm">
        <div className="mb-2 inline-flex rounded-full bg-teal-50 px-3 py-1 text-xs font-medium text-teal-800">
          پیش‌نویس ذخیره شد
        </div>
        <h1 className="text-2xl font-bold text-stone-900">قرعه‌کشی با موفقیت ایجاد شد</h1>
        <p className="mt-2 text-stone-600">
          حالا جوایز را برای این قرعه‌کشی تعریف کنید.
        </p>
        <div className="mt-6 rounded-xl border border-dashed border-teal-300 bg-teal-50/50 px-4 py-4">
          <p className="text-xs font-medium text-teal-800">raffleId</p>
          <p className="mt-1 break-all font-mono text-sm text-stone-900" dir="ltr">
            {createdRaffleId}
          </p>
        </div>
        <p className="mt-4 text-sm text-stone-500">نام: {raffleName}</p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            to={`/admin/raffles/${createdRaffleId}`}
            className="inline-flex rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-800"
          >
            پیکربندی جوایز
          </Link>
          <button
            type="button"
            onClick={() => {
              setCreatedRaffleId(null)
              setRows(null)
              setRaffleName('')
              setFileName('')
              setUniquePeople(0)
            }}
            className="inline-flex rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
          >
            ایجاد قرعه‌کشی دیگر
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-teal-700">مرحله ۱ از چند مرحله</p>
        <h1 className="mt-1 text-2xl font-bold text-stone-900">آپلود شرکت‌کنندگان</h1>
        <p className="mt-1 text-sm text-stone-500">
          فایل Excel را بارگذاری کنید، پیش‌نمایش را بررسی کنید و پیش‌نویس قرعه‌کشی را بسازید.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
          <label htmlFor="raffle-name" className="mb-1.5 block text-sm font-medium text-stone-700">
            نام قرعه‌کشی
          </label>
          <input
            id="raffle-name"
            type="text"
            required
            value={raffleName}
            onChange={(e) => setRaffleName(e.target.value)}
            placeholder="مثلاً: قرعه‌کشی نوروزی ۱۴۰۵"
            className="w-full max-w-xl rounded-xl border border-stone-200 bg-stone-50/80 px-3.5 py-2.5 outline-none transition focus:border-teal-600 focus:bg-white focus:ring-2 focus:ring-teal-600/20"
          />
        </div>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragOver(true)
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={onDrop}
          className={`rounded-2xl border-2 border-dashed bg-white p-8 text-center shadow-sm transition ${
            dragOver ? 'border-teal-500 bg-teal-50/40' : 'border-stone-300'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="M12 16V4m0 0 4 4m-4-4-4 4" strokeLinecap="round" strokeLinejoin="round" />
              <path d="M4 14v4a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-4" strokeLinecap="round" />
            </svg>
          </div>
          <p className="font-medium text-stone-800">فایل Excel را اینجا رها کنید</p>
          <p className="mt-1 text-sm text-stone-500">یا از دکمه زیر انتخاب کنید — فرمت‌های .xlsx و .xls</p>
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="mt-4 rounded-xl border border-stone-200 bg-stone-50 px-4 py-2 text-sm font-medium text-stone-700 hover:bg-stone-100"
          >
            انتخاب فایل
          </button>
          {fileName ? (
            <p className="mt-3 text-sm text-teal-800" dir="ltr">
              {fileName}
            </p>
          ) : null}
        </div>

        {parseError ? (
          <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            {parseError}
          </p>
        ) : null}

        {rows ? (
          <div className="space-y-4 rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-stone-900">پیش‌نمایش</h2>
                <p className="mt-1 text-sm text-stone-600">
                  {toPersianDigits(rows.length)} ردیف / بلیط، متعلق به {toPersianDigits(uniquePeople)} نفر
                  یکتا
                </p>
              </div>
              <p className="text-xs text-stone-400">
                نمایش همه {toPersianDigits(rows.length)} ردیف
              </p>
            </div>

            <div className="max-h-[28rem] overflow-auto rounded-xl border border-stone-100">
              <table className="min-w-full text-sm">
                <thead className="sticky top-0 bg-stone-50 text-stone-600">
                  <tr>
                    <th className="px-3 py-2.5 text-right font-medium">#</th>
                    <th className="px-3 py-2.5 text-right font-medium">نام</th>
                    <th className="px-3 py-2.5 text-right font-medium">موبایل</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row, index) => (
                    <tr key={`${row.rowIndex}-${row.personKey}`} className="border-t border-stone-100">
                      <td className="px-3 py-2 text-stone-400">{toPersianDigits(index + 1)}</td>
                      <td className="px-3 py-2 font-medium text-stone-800">{row.name}</td>
                      <td className="px-3 py-2 text-stone-600" dir="ltr">
                        {row.phone || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {submitError ? (
              <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                {submitError}
              </p>
            ) : null}

            <button
              type="submit"
              disabled={submitting || !raffleName.trim()}
              className="rounded-xl bg-teal-700 px-5 py-3 text-sm font-semibold text-white shadow-md shadow-teal-700/20 transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'در حال ذخیره…' : 'ایجاد پیش‌نویس قرعه‌کشی'}
            </button>
          </div>
        ) : null}
      </form>
    </div>
  )
}
