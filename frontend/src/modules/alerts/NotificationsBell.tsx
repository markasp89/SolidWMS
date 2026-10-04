import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { formatRelative } from '@/core/format'
import { Icon } from '@/core/ui/Icon'
import { useStockVersion } from '@/modules/inventory'

interface NotificationItem {
  id: string
  data: { title: string; message: string; url?: string }
  read_at: string | null
  created_at: string
}

interface NotificationsResponse {
  unread: number
  items: NotificationItem[]
}

/** Topbar bell with in-app notifications (low stock alerts). */
export function NotificationsBell() {
  const { isManager } = useAuth()
  const navigate = useNavigate()
  const version = useStockVersion()
  const [data, setData] = useState<NotificationsResponse | null>(null)
  const [open, setOpen] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!isManager) return
    const load = () => api.get<NotificationsResponse>('/notifications').then(setData).catch(() => {})
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [isManager, version])

  useEffect(() => {
    if (!open) return
    const close = (e: MouseEvent) => !panel.current?.contains(e.target as Node) && setOpen(false)
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [open])

  if (!isManager) return null

  const markRead = async (ids?: string[]) => setData(await api.post<NotificationsResponse>('/notifications/read', { ids }))

  return (
    <div className="bell" ref={panel}>
      <button type="button" className="btn btn-ghost btn-icon" onClick={() => setOpen((v) => !v)} aria-label="Powiadomienia">
        <Icon name="bell" />
        {data && data.unread > 0 && <span className="bell-count">{data.unread}</span>}
      </button>
      {open && (
        <div className="bell-panel">
          <div className="bell-header">
            <strong>Powiadomienia</strong>
            {data && data.unread > 0 && (
              <button type="button" className="link" onClick={() => markRead()}>
                Oznacz jako przeczytane
              </button>
            )}
          </div>
          {!data?.items.length && <p className="muted bell-empty">Brak powiadomień.</p>}
          <ul>
            {data?.items.map((n) => (
              <li key={n.id} className={n.read_at ? '' : 'is-unread'}>
                <button
                  type="button"
                  onClick={() => {
                    if (!n.read_at) void markRead([n.id])
                    setOpen(false)
                    if (n.data.url) navigate(n.data.url)
                  }}
                >
                  <strong>{n.data.title}</strong>
                  <span>{n.data.message}</span>
                  <small className="muted">{formatRelative(n.created_at)}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
