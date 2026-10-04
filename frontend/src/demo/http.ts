/**
 * Responses, Laravel-like errors and a tiny request validator with Polish messages.
 */

export interface DemoResponse {
  status: number
  body?: unknown
}

export type FieldErrors = Record<string, string[]>

export class HttpError extends Error {
  readonly status: number
  readonly errors: FieldErrors | undefined

  constructor(status: number, message: string, errors?: FieldErrors) {
    super(message)
    this.status = status
    this.errors = errors
  }

  toResponse(): DemoResponse {
    return { status: this.status, body: this.errors ? { message: this.message, errors: this.errors } : { message: this.message } }
  }
}

export const json = (body: unknown, status = 200): DemoResponse => ({ status, body })
export const created = (body: unknown): DemoResponse => ({ status: 201, body })
export const noContent = (): DemoResponse => ({ status: 204 })

export const NOT_FOUND = 'Nie znaleziono zasobu.'
export const FORBIDDEN = 'Brak uprawnień do wykonania tej operacji.'

export const notFound = (message = NOT_FOUND): HttpError => new HttpError(404, message)
export const forbidden = (message = FORBIDDEN): HttpError => new HttpError(403, message)

/** Builds a Laravel ValidationException-like error. */
export function validationError(errors: FieldErrors): HttpError {
  const messages = Object.values(errors).flat()
  const extra = messages.length - 1
  const message = extra > 0 ? `${messages[0]} (oraz ${extra} ${extra === 1 ? 'inny błąd' : 'innych błędów'})` : (messages[0] ?? 'Popraw błędy w formularzu.')
  return new HttpError(422, message, errors)
}

/** Throws a 422 for one field. */
export function invalid(field: string, message: string): never {
  throw validationError({ [field]: [message] })
}

// Validation -----------------------------------------------------------------

const LABELS: Record<string, string> = {
  name: 'nazwa',
  email: 'e-mail',
  password: 'hasło',
  role: 'rola',
  is_active: 'aktywne',
  code: 'kod',
  address: 'adres',
  description: 'opis',
  color: 'kolor',
  shape: 'obszar',
  floor_id: 'piętro',
  level: 'poziom',
  sku: 'SKU',
  barcode: 'kod kreskowy',
  unit: 'jednostka',
  quantity: 'ilość',
  note: 'notatka',
  slot: 'miejsce',
  to_slot: 'miejsce docelowe',
  batch: 'partia',
  expires_at: 'data ważności',
  product_id: 'produkt',
  sector_id: 'sektor',
  to_sector_id: 'sektor docelowy',
  warehouse_id: 'magazyn',
  stock_item_id: 'lokalizacja',
  counted: 'policzona ilość',
  min_quantity: 'stan minimalny',
  items: 'pozycje',
  lines: 'pozycje',
  type: 'typ',
  counterparty: 'kontrahent',
  url: 'adres URL',
  events: 'zdarzenia',
  abilities: 'uprawnienia',
  active: 'aktywny',
  enabled: 'włączony',
  subject_type: 'typ obiektu',
  subject_id: 'obiekt',
  photo: 'zdjęcie',
  floor_plan: 'rzut',
  caption: 'podpis',
  warehouse_ids: 'magazyny',
  q: 'szukana fraza',
  from: 'od',
  to: 'do',
  mode: 'tryb',
  data: 'dane',
}

const label = (field: string): string => {
  const last = field.split('.').filter((part) => !/^\d+$/.test(part)).pop() ?? field
  return LABELS[last] ?? last.replaceAll('_', ' ')
}

export const MESSAGES = {
  required: (f: string) => `Pole ${label(f)} jest wymagane.`,
  string: (f: string) => `Pole ${label(f)} musi być tekstem.`,
  max: (f: string, n: number) => `Pole ${label(f)} może mieć maksymalnie ${n} znaków.`,
  numeric: (f: string) => `Pole ${label(f)} musi być liczbą.`,
  integer: (f: string) => `Pole ${label(f)} musi być liczbą całkowitą.`,
  gt0: (f: string) => `Pole ${label(f)} musi być większe od 0.`,
  gte0: (f: string) => `Pole ${label(f)} nie może być ujemne.`,
  maxNumber: (f: string, n: number) => `Pole ${label(f)} nie może być większe niż ${n}.`,
  between: (f: string, a: number, b: number) => `Pole ${label(f)} musi mieścić się między ${a} a ${b}.`,
  boolean: (f: string) => `Pole ${label(f)} musi mieć wartość tak lub nie.`,
  array: (f: string) => `Pole ${label(f)} musi być listą.`,
  minItems: (f: string, n: number) => `Pole ${label(f)} musi mieć co najmniej ${n} elementy.`,
  date: (f: string) => `Pole ${label(f)} nie jest poprawną datą.`,
  email: (f: string) => `Pole ${label(f)} musi być poprawnym adresem e-mail.`,
  in: (f: string) => `Wybrana wartość pola ${label(f)} jest nieprawidłowa.`,
  exists: (f: string) => `Wybrana wartość pola ${label(f)} jest nieprawidłowa.`,
  unique: (f: string) => `Taka wartość pola ${label(f)} już istnieje.`,
  regex: (f: string) => `Format pola ${label(f)} jest nieprawidłowy.`,
  prohibited: (f: string) => `Pole ${label(f)} jest niedozwolone.`,
  url: (f: string) => `Pole ${label(f)} musi być poprawnym adresem URL.`,
}

export type Body = Record<string, unknown>

export const isObject = (value: unknown): value is Body =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof FormData)

const MAX_QUANTITY = 999999999

interface StringRules {
  required?: boolean
  max?: number
  regex?: RegExp
  regexMessage?: string
}

interface NumberRules {
  required?: boolean
  integer?: boolean
  gt0?: boolean
  gte0?: boolean
  max?: number
  min?: number
}

/**
 * Validates request input field by field. Strings are trimmed and empty strings
 * become null (Laravel's TrimStrings + ConvertEmptyStringsToNull middleware).
 * Every getter returns undefined when the field is absent or invalid.
 */
export class Validator {
  readonly errors: FieldErrors
  private readonly data: Body
  private readonly prefix: string

  constructor(data: unknown, prefix = '', errors: FieldErrors = {}) {
    this.data = isObject(data) ? data : {}
    this.prefix = prefix
    this.errors = errors
  }

  /** Validator for a nested object sharing the error bag. */
  nested(field: string, value: unknown): Validator {
    return new Validator(value, this.key(field) + '.', this.errors)
  }

  key(field: string): string {
    return this.prefix + field
  }

  fail(field: string, message: string): void {
    const key = this.key(field)
    ;(this.errors[key] ??= []).push(message)
  }

  get failed(): boolean {
    return Object.keys(this.errors).length > 0
  }

  /** Throws the collected errors as a 422. */
  validate(): void {
    if (this.failed) throw validationError(this.errors)
  }

  has(field: string): boolean {
    return Object.prototype.hasOwnProperty.call(this.data, field) && this.data[field] !== undefined
  }

  raw(field: string): unknown {
    const value = this.data[field]
    if (typeof value === 'string') {
      const trimmed = value.trim()
      return trimmed === '' ? null : trimmed
    }
    return value
  }

  filled(field: string): boolean {
    const value = this.raw(field)
    return value !== null && value !== undefined && !(Array.isArray(value) && value.length === 0)
  }

  private missing(field: string, required: boolean | undefined): boolean {
    if (this.filled(field)) return false
    if (required) this.fail(field, MESSAGES.required(this.key(field)))
    return true
  }

  string(field: string, rules: StringRules = {}): string | null | undefined {
    if (this.missing(field, rules.required)) return this.has(field) ? null : undefined
    const value = this.raw(field)
    const key = this.key(field)
    if (typeof value !== 'string') {
      this.fail(field, MESSAGES.string(key))
      return undefined
    }
    if (rules.max !== undefined && value.length > rules.max) {
      this.fail(field, MESSAGES.max(key, rules.max))
      return undefined
    }
    if (rules.regex && !rules.regex.test(value)) {
      this.fail(field, rules.regexMessage ?? MESSAGES.regex(key))
      return undefined
    }
    return value
  }

  number(field: string, rules: NumberRules = {}): number | null | undefined {
    if (this.missing(field, rules.required)) return this.has(field) ? null : undefined
    const value = this.raw(field)
    const key = this.key(field)
    const parsed = typeof value === 'number' ? value : typeof value === 'string' && /^-?\d+(\.\d+)?$/.test(value) ? Number(value) : NaN
    if (!Number.isFinite(parsed)) {
      this.fail(field, rules.integer ? MESSAGES.integer(key) : MESSAGES.numeric(key))
      return undefined
    }
    if (rules.integer && !Number.isInteger(parsed)) {
      this.fail(field, MESSAGES.integer(key))
      return undefined
    }
    if (rules.gt0 && parsed <= 0) {
      this.fail(field, MESSAGES.gt0(key))
      return undefined
    }
    if (rules.gte0 && parsed < 0) {
      this.fail(field, MESSAGES.gte0(key))
      return undefined
    }
    if (rules.min !== undefined && rules.max !== undefined && (parsed < rules.min || parsed > rules.max)) {
      this.fail(field, MESSAGES.between(key, rules.min, rules.max))
      return undefined
    }
    if (rules.max !== undefined && parsed > rules.max) {
      this.fail(field, MESSAGES.maxNumber(key, rules.max))
      return undefined
    }
    return parsed
  }

  /** Positive quantity (required, numeric, gt:0, max:999999999). */
  quantity(field = 'quantity', required = true): number | undefined {
    return this.number(field, { required, gt0: true, max: MAX_QUANTITY }) ?? undefined
  }

  integer(field: string, required = false): number | null | undefined {
    return this.number(field, { required, integer: true })
  }

  boolean(field: string, required = false): boolean | undefined {
    if (this.missing(field, required)) return undefined
    const value = this.raw(field)
    if (value === true || value === 1 || value === '1' || value === 'true') return true
    if (value === false || value === 0 || value === '0' || value === 'false') return false
    this.fail(field, MESSAGES.boolean(this.key(field)))
    return undefined
  }

  array(field: string, required = false, requiredMessage?: string): unknown[] | null | undefined {
    if (!this.filled(field)) {
      if (required) this.fail(field, requiredMessage ?? MESSAGES.required(this.key(field)))
      return this.has(field) ? null : undefined
    }
    const value = this.raw(field)
    if (!Array.isArray(value)) {
      this.fail(field, MESSAGES.array(this.key(field)))
      return undefined
    }
    return value
  }

  /** Date as YYYY-MM-DD. */
  date(field: string, required = false): string | null | undefined {
    if (this.missing(field, required)) return this.has(field) ? null : undefined
    const value = this.raw(field)
    const normalized = typeof value === 'string' ? toDateString(value) : null
    if (!normalized) {
      this.fail(field, MESSAGES.date(this.key(field)))
      return undefined
    }
    return normalized
  }

  oneOf<T extends string>(field: string, values: readonly T[], required = false): T | null | undefined {
    if (this.missing(field, required)) return this.has(field) ? null : undefined
    const value = this.raw(field)
    if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
      this.fail(field, MESSAGES.in(this.key(field)))
      return undefined
    }
    return value as T
  }

  /** Optional location dimensions (StockOperationRequest::dimensionRules). */
  dimensions(prefix = ''): { slot: string | null | undefined; batch: string | null | undefined; expires_at: string | null | undefined } {
    return {
      slot: this.string(prefix + 'slot', { max: 32, regex: SLOT_REGEX, regexMessage: SLOT_MESSAGE }),
      batch: this.string(prefix + 'batch', { max: 64 }),
      expires_at: this.date(prefix + 'expires_at'),
    }
  }
}

export const SLOT_REGEX = /^[A-Za-z0-9_.\-/ ]+$/
export const SLOT_MESSAGE = 'Miejsce może zawierać litery, cyfry oraz znaki - _ . /'
export const CODE_REGEX = /^[A-Z0-9_.-]+$/
export const CODE_MESSAGE = 'Kod może zawierać tylko wielkie litery, cyfry oraz znaki _ . -'
export const MAX_QTY = MAX_QUANTITY

/** "2026-10-04", "2026-10-04T10:00:00Z" ... -> "2026-10-04" (null when not a date). */
export function toDateString(value: string): string | null {
  const plain = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (plain) {
    const date = new Date(Number(plain[1]), Number(plain[2]) - 1, Number(plain[3]))
    return date.getMonth() === Number(plain[2]) - 1 ? value : null
  }
  const time = Date.parse(value)
  if (Number.isNaN(time)) return null
  return localDate(new Date(time))
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Local calendar date as YYYY-MM-DD. */
export const localDate = (date: Date): string => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`

/** ISO timestamp -> database style "YYYY-MM-DD HH:MM:SS" (UTC), as raw SQL results return it. */
export const dbDateTime = (iso: string | null): string | null => (iso ? iso.slice(0, 19).replace('T', ' ') : null)

export const round3 = (value: number): number => Math.round(value * 1000) / 1000

/** 12.5 -> "12.5", 3 -> "3" (number_format + rtrim as in PHP). */
export const formatQuantity = (value: number, decimal = '.'): string =>
  value.toFixed(3).replace(/0+$/, '').replace(/\.$/, '').replace('.', decimal)
