import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '@/core/auth/AuthContext'
import { collectErrors, Form, rules, TextField, useForm } from '@/core/ui/form'

export function LoginPage() {
  const { user, login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = (location.state as { from?: string } | null)?.from ?? '/'

  const form = useForm(
    { email: '', password: '' },
    {
      validate: (v) =>
        collectErrors([
          ['email', rules.required(v.email) ?? rules.email(v.email)],
          ['password', rules.required(v.password)],
        ]),
      onSubmit: async (v) => {
        await login(v.email, v.password)
        navigate(from, { replace: true })
      },
    },
  )

  if (user) return <Navigate to={from} replace />

  return (
    <div className="login">
      <div className="login-card">
        <div className="brand brand-lg">
          <img src="/favicon.svg" alt="" width={40} height={40} />
          <span>
            Solid<strong>WMS</strong>
          </span>
        </div>
        <p className="login-subtitle">Zaloguj się, aby sprawdzić, gdzie leży towar.</p>
        <Form form={form} submitLabel="Zaloguj się">
          <TextField form={form} name="email" label="E-mail" type="email" autoComplete="username" autoFocus required />
          <TextField
            form={form}
            name="password"
            label="Hasło"
            type="password"
            autoComplete="current-password"
            required
          />
        </Form>
      </div>
    </div>
  )
}
