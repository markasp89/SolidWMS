import type { ReactNode } from 'react'
import { Icon, type IconName } from './Icon'

export function Spinner({ label = 'Ładowanie…' }: { label?: string }) {
  return (
    <div className="loading" role="status">
      <span className="spinner" />
      <span>{label}</span>
    </div>
  )
}

export function EmptyState({ icon = 'box', title, children }: { icon?: IconName; title: string; children?: ReactNode }) {
  return (
    <div className="empty">
      <Icon name={icon} size={36} />
      <p className="empty-title">{title}</p>
      {children && <div className="empty-body">{children}</div>}
    </div>
  )
}

export function PageHeader({
  title,
  subtitle,
  actions,
  back,
}: {
  title: ReactNode
  subtitle?: ReactNode
  actions?: ReactNode
  back?: ReactNode
}) {
  return (
    <div className="page-header">
      <div className="page-header-main">
        {back && <div className="page-back">{back}</div>}
        <h1>{title}</h1>
        {subtitle && <p className="page-subtitle">{subtitle}</p>}
      </div>
      {actions && <div className="page-actions">{actions}</div>}
    </div>
  )
}

export function ErrorMessage({ error, onRetry }: { error: Error; onRetry?: () => void }) {
  return (
    <div className="alert alert-error" role="alert">
      {error.message}
      {onRetry && (
        <button type="button" className="link" onClick={onRetry}>
          Spróbuj ponownie
        </button>
      )}
    </div>
  )
}

export function ColorDot({ color }: { color: string }) {
  return <span className="color-dot" style={{ background: color }} aria-hidden="true" />
}

export function Card({ title, actions, children, className = '' }: { title?: ReactNode; actions?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`card ${className}`}>
      {(title || actions) && (
        <header className="card-header">
          {title && <h2>{title}</h2>}
          {actions && <div className="card-actions">{actions}</div>}
        </header>
      )}
      <div className="card-body">{children}</div>
    </section>
  )
}
