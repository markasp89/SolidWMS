import { BrowserRouter, Route, Routes } from 'react-router-dom'
import { AuthProvider } from '@/core/auth/AuthContext'
import { RequireAuth, RequireRole } from '@/core/auth/guards'
import { AppLayout } from '@/core/layout/AppLayout'
import { ModulesProvider } from '@/core/modules/registry'
import { FeedbackProvider } from '@/core/ui/feedback'
import { EmptyState } from '@/core/ui/misc'
import { modules } from './modules'

export function App() {
  const publicRoutes = modules.flatMap((m) => m.publicRoutes ?? [])
  const routes = modules.flatMap((m) => m.routes ?? [])

  return (
    <ModulesProvider modules={modules}>
      <AuthProvider>
        <FeedbackProvider>
          <BrowserRouter>
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
                <Route path="*" element={<EmptyState icon="search" title="Nie znaleziono strony" />} />
              </Route>
            </Routes>
          </BrowserRouter>
        </FeedbackProvider>
      </AuthProvider>
    </ModulesProvider>
  )
}
