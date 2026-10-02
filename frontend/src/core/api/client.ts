/**
 * Minimal fetch wrapper for the SolidWMS API (bearer token auth, JSON, Laravel errors).
 */

const API_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? ''
const TOKEN_KEY = 'solidwms.token'

export type FieldErrors = Record<string, string>

export class ApiError extends Error {
  readonly status: number
  readonly fieldErrors: FieldErrors

  constructor(status: number, message: string, fieldErrors: FieldErrors = {}) {
    super(message)
    this.status = status
    this.fieldErrors = fieldErrors
  }

  get isValidation(): boolean {
    return this.status === 422
  }
}

let unauthorizedHandler: (() => void) | null = null

export const tokenStore = {
  get: (): string | null => localStorage.getItem(TOKEN_KEY),
  set: (token: string | null) => {
    if (token) localStorage.setItem(TOKEN_KEY, token)
    else localStorage.removeItem(TOKEN_KEY)
  },
}

export function onUnauthorized(handler: () => void) {
  unauthorizedHandler = handler
}

/** Turns an API relative path (e.g. a signed floor plan URL) into an absolute one. */
export function apiUrl(path: string): string {
  return /^https?:\/\//.test(path) ? path : `${API_URL}${path}`
}

type Query = Record<string, string | number | boolean | null | undefined>

export interface RequestOptions {
  method?: string
  body?: unknown
  query?: Query
  signal?: AbortSignal
}

function buildUrl(path: string, query?: Query): string {
  const url = apiUrl(`/api${path}`)
  if (!query) return url
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value))
  }
  const qs = params.toString()
  return qs ? `${url}?${qs}` : url
}

export async function rawRequest(path: string, options: RequestOptions = {}): Promise<Response> {
  const headers: Record<string, string> = { Accept: 'application/json' }
  const token = tokenStore.get()
  if (token) headers.Authorization = `Bearer ${token}`

  let body: BodyInit | undefined
  if (options.body instanceof FormData) {
    body = options.body
  } else if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json'
    body = JSON.stringify(options.body)
  }

  let response: Response
  try {
    response = await fetch(buildUrl(path, options.query), {
      method: options.method ?? (body ? 'POST' : 'GET'),
      headers,
      body,
      signal: options.signal,
    })
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') throw error
    throw new ApiError(0, 'Brak połączenia z serwerem.')
  }

  if (!response.ok) {
    throw await toApiError(response)
  }

  return response
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const response = await rawRequest(path, options)
  if (response.status === 204) return undefined as T
  return (await response.json()) as T
}

async function toApiError(response: Response): Promise<ApiError> {
  let payload: { message?: string; errors?: Record<string, string[]> } = {}
  try {
    payload = await response.json()
  } catch {
    // Non JSON error page.
  }

  if (response.status === 401) {
    unauthorizedHandler?.()
  }

  const fieldErrors: FieldErrors = {}
  for (const [field, messages] of Object.entries(payload.errors ?? {})) {
    fieldErrors[field] = messages[0]
  }

  const fallback: Record<number, string> = {
    401: 'Sesja wygasła. Zaloguj się ponownie.',
    403: 'Brak uprawnień do wykonania tej operacji.',
    404: 'Nie znaleziono zasobu.',
    413: 'Przesyłane dane są zbyt duże.',
    422: 'Popraw błędy w formularzu.',
    429: 'Zbyt wiele prób. Spróbuj ponownie za chwilę.',
  }

  const message =
    (response.status === 422 ? Object.values(fieldErrors)[0] : payload.message) ||
    fallback[response.status] ||
    'Wystąpił błąd serwera.'

  return new ApiError(response.status, message, fieldErrors)
}

export const api = {
  get: <T>(path: string, query?: Query, signal?: AbortSignal) => request<T>(path, { query, signal }),
  post: <T>(path: string, body?: unknown) => request<T>(path, { method: 'POST', body: body ?? {} }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body }),
  delete: <T = void>(path: string) => request<T>(path, { method: 'DELETE' }),
}

export interface Paginated<T> {
  data: T[]
  meta: { current_page: number; last_page: number; per_page: number; total: number }
}
