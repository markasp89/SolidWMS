import { BrowserRouter, HashRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/core/auth/AuthContext'
import { RequireAuth, RequireRole } from '@/core/auth/guards'
import { isDemo } from '@/core/demo'
import { AppLayout } from '@/core/layout/AppLayout'
import { ModulesProvider, useModuleRegistry } from '@/core/modules/registry'
import { FeedbackProvider } from '@/core/ui/feedback'
import { EmptyState, Spinner } from '@/core/ui/misc'
import { modules } from './modules'

function AppRoutes() {
  const { modules: enabled, loading } = useModuleRegistry()
  const publicRoutes = modules.flatMap((m) => m.publicRoutes ?? [])
  const routes = enabled.flatMap((m) => m.routes ?? [])

  return (
    <Routes>
      {publicRoutes.map((r) => (
        <Route key={r.path} path={r.path} element={r.element} />
      ))}
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        {routes.map((r) => (
          <Route key={r.path} path={r.path} element={<RequireRole roles={r.roles}>{r.element}</RequireRole>} />
        ))}
        <Route
          path="*"
          element={loading ? <Spinner /> : <EmptyState icon="search" title="Nie znaleziono strony">Strona nie istnieje albo jej moduł jest wyłączony.</EmptyState>}
        />
      </Route>
    </Routes>
  )
}

// The demo is a single file hosted under an arbitrary path, so it routes by URL hash.
const Router = isDemo ? HashRouter : BrowserRouter

export function App() {
  return (
    <AuthProvider>
      <ModulesProvider modules={modules}>
        <FeedbackProvider>
          <Router>
            <AppRoutes />
          </Router>
        </FeedbackProvider>
      </ModulesProvider>
    </AuthProvider>
  )
}
