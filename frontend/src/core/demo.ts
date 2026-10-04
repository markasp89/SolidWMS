/**
 * Demo mode (`npm run build:demo`): the app runs without a server. API calls are
 * answered in the browser by src/demo (data kept in this browser only).
 */
export const isDemo = import.meta.env.VITE_DEMO === '1'

export const DEMO_ACCOUNTS = [
  { email: 'admin@solidwms.local', label: 'Administrator', hint: 'magazyny, sektory, moduły, użytkownicy' },
  { email: 'kierownik@solidwms.local', label: 'Kierownik zmiany', hint: 'zatwierdzanie, raporty, alerty' },
  { email: 'pracownik@solidwms.local', label: 'Pracownik', hint: 'szukanie, przyjęcia, wydania, palety' },
]

interface DemoServer {
  handleDemoRequest(req: {
    method: string
    path: string
    query: URLSearchParams
    body: unknown
    token: string | null
  }): Promise<{ status: number; body?: unknown }>
  resetDemo(): void
}

// Loaded lazily and only in demo builds; regular builds do not include it.
const demoServers = import.meta.glob<DemoServer>('../demo/server.ts')

async function loadServer(): Promise<DemoServer> {
  const load = demoServers['../demo/server.ts']
  if (!load) throw new Error('Brak serwera demo (src/demo/server.ts).')
  return load()
}

/** Routes fetch() calls to /api/* to the in-browser demo server. */
export async function installDemoApi(): Promise<void> {
  const { handleDemoRequest } = await loadServer()
  const realFetch = window.fetch.bind(window)

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, window.location.href)
    const index = url.pathname.indexOf('/api/')
    if (index === -1) return realFetch(input, init)

    const headers = new Headers(init?.headers)
    const raw = init?.body
    let body: unknown = undefined
    if (raw instanceof FormData) body = raw
    else if (typeof raw === 'string' && raw !== '') body = JSON.parse(raw)

    const auth = headers.get('Authorization')
    const result = await handleDemoRequest({
      method: (init?.method ?? 'GET').toUpperCase(),
      path: url.pathname.slice(index + 4),
      query: url.searchParams,
      body,
      token: auth?.startsWith('Bearer ') ? auth.slice(7) : null,
    })

    if (result.status === 204 || result.body === undefined) return new Response(null, { status: result.status === 200 ? 204 : result.status })
    return new Response(JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}

export async function resetDemoData(): Promise<void> {
  const { resetDemo } = await loadServer()
  resetDemo()
}
