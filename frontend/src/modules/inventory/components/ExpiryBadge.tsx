const DAY = 86_400_000

/** Expiry date coloured by urgency: expired, within 30 days, later. */
export function ExpiryBadge({ date }: { date: string }) {
  const days = Math.ceil((new Date(`${date}T23:59:59`).getTime() - Date.now()) / DAY)
  const formatted = new Date(`${date}T00:00:00`).toLocaleDateString('pl-PL')
  const kind = days < 0 ? 'expired' : days <= 30 ? 'soon' : 'ok'
  const label = days < 0 ? `przeterminowane ${formatted}` : days <= 30 ? `ważne do ${formatted} (${days} dni)` : `ważne do ${formatted}`

  return <span className={`badge badge-expiry-${kind}`}>{label}</span>
}
