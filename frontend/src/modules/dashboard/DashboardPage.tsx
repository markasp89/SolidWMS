import { useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import { useAsync } from '@/core/hooks/useAsync'
import { Extension } from '@/core/modules/registry'
import { Icon } from '@/core/ui/Icon'
import { Card, EmptyState, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { MovementList, type Movement } from '@/modules/inventory'

interface Dashboard {
  stats: { warehouses: number; sectors: number; products: number; locations: number; products_without_location: number }
  recent_movements: Movement[]
}

export function DashboardPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const [query, setQuery] = useState('')
  const { data, error, loading, reload } = useAsync((signal) => api.get<Dashboard>('/dashboard', undefined, signal), [])

  const search = (e: FormEvent) => {
    e.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  const stats = data?.stats

  return (
    <>
      <PageHeader title={`Dzień dobry, ${user?.name.split(' ')[0]}`} subtitle="Czego dziś szukasz?" />
      <form className="search-hero" onSubmit={search} role="search">
        <Icon name="search" size={22} />
        <input
          type="search"
          placeholder="Nazwa produktu, SKU lub kod kreskowy…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Szukaj produktu"
        />
        <button type="submit" className="btn btn-primary">
          Szukaj
        </button>
      </form>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {stats && (
        <div className="stats">
          <Link to="/warehouses" className="stat">
            <span className="stat-value">{stats.warehouses}</span>
            <span className="stat-label">Magazyny</span>
          </Link>
          <Link to="/warehouses" className="stat">
            <span className="stat-value">{stats.sectors}</span>
            <span className="stat-label">Sektory</span>
          </Link>
          <Link to="/products" className="stat">
            <span className="stat-value">{stats.products}</span>
            <span className="stat-label">Produkty</span>
          </Link>
          <Link to="/products" className={`stat ${stats.products_without_location ? 'stat-warn' : ''}`}>
            <span className="stat-value">{stats.products_without_location}</span>
            <span className="stat-label">Bez lokalizacji</span>
          </Link>
        </div>
      )}

      <div className="widgets">
        <Extension name="dashboard.widgets" props={{}} />
      </div>

      {data && (
        <Card title="Ostatnie operacje" actions={<Link to="/movements">Cała historia →</Link>}>
          {data.recent_movements.length ? (
            <MovementList movements={data.recent_movements} />
          ) : (
            <EmptyState icon="history" title="Brak operacji" />
          )}
        </Card>
      )}
    </>
  )
}
