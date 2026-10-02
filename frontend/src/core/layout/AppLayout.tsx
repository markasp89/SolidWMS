import { useEffect, useState, type FormEvent } from 'react'
import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { useModules } from '@/core/modules/registry'
import { Icon } from '@/core/ui/Icon'

export function AppLayout() {
  const { user, logout, hasRole } = useAuth()
  const modules = useModules()
  const location = useLocation()
  const navigate = useNavigate()
  const [menuOpen, setMenuOpen] = useState(false)
  const [query, setQuery] = useState('')

  useEffect(() => setMenuOpen(false), [location.pathname])

  const nav = modules
    .flatMap((m) => m.nav ?? [])
    .filter((item) => !item.roles || hasRole(...item.roles))
    .sort((a, b) => (a.order ?? 100) - (b.order ?? 100))

  const search = (event: FormEvent) => {
    event.preventDefault()
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`)
  }

  return (
    <div className={`layout ${menuOpen ? 'menu-open' : ''}`}>
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width={30} height={30} />
          <span>
            Solid<strong>WMS</strong>
          </span>
        </div>
        <nav className="nav" aria-label="Menu główne">
          {nav.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.to === '/'} className="nav-link">
              <Icon name={item.icon} />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div>
            <div className="sidebar-user-name">{user?.name}</div>
            <div className="sidebar-user-role">{user?.role_label}</div>
          </div>
          <button type="button" className="btn btn-ghost btn-icon" onClick={logout} title="Wyloguj" aria-label="Wyloguj">
            <Icon name="logout" />
          </button>
        </div>
      </aside>
      <div className="sidebar-backdrop" onClick={() => setMenuOpen(false)} />

      <div className="main">
        <header className="topbar">
          <button
            type="button"
            className="btn btn-ghost btn-icon topbar-menu"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label="Menu"
          >
            <Icon name="menu" />
          </button>
          <form className="topbar-search" onSubmit={search} role="search">
            <Icon name="search" />
            <input
              type="search"
              placeholder="Gdzie jest…? Szukaj produktu po nazwie, SKU lub kodzie kreskowym"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              aria-label="Szukaj produktu"
            />
          </form>
        </header>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  )
}
