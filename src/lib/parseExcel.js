const NAME_HEADERS = ['نام', 'name', 'Name', 'NAME', 'اسم']
const PHONE_HEADERS = [
  'موبایل',
  'شماره',
  'شماره موبایل',
  'تلفن',
  'phone',
  'Phone',
  'PHONE',
  'mobile',
  'Mobile',
]

function normalizeHeader(value) {
  return String(value ?? '')
    .trim()
    .replace(/\s+/g, ' ')
}

function findColumnIndex(headers, candidates) {
  const normalized = headers.map(normalizeHeader)
  for (const candidate of candidates) {
    const idx = normalized.findIndex(
      (h) => h === candidate || h.toLowerCase() === candidate.toLowerCase(),
    )
    if (idx !== -1) return idx
  }
  return -1
}

export function normalizePhone(phone) {
  if (phone == null || phone === '') return ''
  const ascii = String(phone).replace(/[۰-۹]/g, (d) => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
  return ascii.replace(/\D/g, '')
}

export function makePersonKey(name, phone) {
  const n = String(name || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
  return `${n}|${normalizePhone(phone)}`
}

export async function parseParticipantsFromFile(file) {
  const XLSX = await import('xlsx')
  const buffer = await file.arrayBuffer()
  const workbook = XLSX.read(buffer, { type: 'array' })

  const sheetName = workbook.SheetNames[0]
  if (!sheetName) {
    throw new Error('فایل اکسل خالی است')
  }

  const sheet = workbook.Sheets[sheetName]
  const matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '', raw: false })

  if (!matrix.length) {
    throw new Error('برگی با داده پیدا نشد')
  }

  const headers = matrix[0].map((cell) => normalizeHeader(cell))
  const nameIdx = findColumnIndex(headers, NAME_HEADERS)
  const phoneIdx = findColumnIndex(headers, PHONE_HEADERS)

  if (nameIdx === -1) {
    throw new Error('ستون نام پیدا نشد (نام / Name)')
  }

  const rows = []
  const unique = new Set()

  for (let i = 1; i < matrix.length; i++) {
    const line = matrix[i] || []
    const name = String(line[nameIdx] ?? '').trim()
    if (!name) continue

    const phone = phoneIdx !== -1 ? String(line[phoneIdx] ?? '').trim() : ''
    const rowIndex = i + 1
    const personKey = makePersonKey(name, phone)
    unique.add(personKey)
    rows.push({ name, phone, rowIndex, personKey })
  }

  if (!rows.length) {
    throw new Error('هیچ ردیف معتبری در فایل پیدا نشد')
  }

  return { rows, uniquePeople: unique.size }
}

export function toPersianDigits(value) {
  return String(value).replace(/\d/g, (d) => '۰۱۲۳۴۵۶۷۸۹'[d])
}
