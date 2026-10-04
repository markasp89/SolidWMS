import { Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useState } from 'react'
import { useAuth } from '@/core/auth/AuthContext'
import { Logo } from '@/core/ui/Logo'
import { DEMO_ACCOUNTS, isDemo } from '@/core/demo'
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
          <Logo size={40} />
          <span>
            Solid<strong>WMS</strong>
          </span>
        </div>
        <p className="login-subtitle">Zaloguj się, aby sprawdzić, gdzie leży towar.</p>
        {isDemo && <DemoAccounts onPick={async (email) => {
          await login(email, 'password')
          navigate(from, { replace: true })
        }} />}
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

/** Demo: one tap logs in with one of the example roles. */
function DemoAccounts({ onPick }: { onPick: (email: string) => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null)

  return (
    <div className="demo-accounts">
      <p className="demo-accounts-title">Wersja demo – wybierz rolę:</p>
      {DEMO_ACCOUNTS.map((account) => (
        <button
          key={account.email}
          type="button"
          className="demo-account"
          disabled={busy !== null}
          onClick={async () => {
            setBusy(account.email)
            try {
              await onPick(account.email)
            } finally {
              setBusy(null)
            }
          }}
        >
          <strong>{account.label}</strong>
          <span>{account.hint}</span>
        </button>
      ))}
      <p className="demo-accounts-or">lub zaloguj się ręcznie (hasło: password)</p>
    </div>
  )
}
