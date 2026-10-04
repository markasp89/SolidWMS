import { useState } from 'react'
import { api } from '@/core/api/client'
import { useAuth } from '@/core/auth/AuthContext'
import type { User } from '@/core/auth/types'
import { formatDateTime } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Extension } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { CheckboxField, collectErrors, FormModal, rules, SelectField, TextField, useForm } from '@/core/ui/form'
import { ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'

export function UsersPage() {
  const { user: me } = useAuth()
  const { toast, confirm } = useFeedback()
  const [editing, setEditing] = useState<User | 'new' | null>(null)
  const { data, error, loading, reload } = useAsync((signal) => api.get<User[]>('/users', undefined, signal), [])

  const remove = async (user: User) => {
    const ok = await confirm({
      title: 'Usunąć użytkownika?',
      message: `Konto ${user.name} (${user.email}) zostanie usunięte. Historia operacji pozostanie bez autora.`,
      confirmLabel: 'Usuń',
      danger: true,
    })
    if (!ok) return
    try {
      await api.delete(`/users/${user.id}`)
      toast('Użytkownik usunięty.')
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <>
      <PageHeader
        title="Użytkownicy"
        subtitle="Administrator definiuje magazyny i sektory, kierownik zatwierdza i raportuje, pracownik zarządza produktami i ilościami."
        actions={
          <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
            Nowy użytkownik
          </Button>
        }
      />
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Imię i nazwisko</th>
                <th>E-mail</th>
                <th>Rola</th>
                <th>Status</th>
                <th>Utworzono</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((u) => (
                <tr key={u.id}>
                  <td>
                    {u.name} {u.id === me?.id && <span className="muted">(Ty)</span>}
                  </td>
                  <td>{u.email}</td>
                  <td>
                    <span className={`badge ${u.role === 'admin' ? 'badge-admin' : u.role === 'manager' ? 'badge-manager' : ''}`}>{u.role_label}</span>
                  </td>
                  <td>{u.is_active ? 'Aktywny' : <span className="badge badge-warn">Nieaktywny</span>}</td>
                  <td className="nowrap">{formatDateTime(u.created_at)}</td>
                  <td className="actions">
                    <Extension name="user.actions" props={{ user: u }} />
                    <Button size="sm" icon="edit" variant="ghost" onClick={() => setEditing(u)} aria-label="Edytuj" />
                    {u.id !== me?.id && (
                      <Button size="sm" icon="trash" variant="ghost" onClick={() => remove(u)} aria-label="Usuń" />
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <UserFormModal
          user={editing === 'new' ? undefined : editing}
          isSelf={editing !== 'new' && editing.id === me?.id}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null)
            toast('Zapisano.')
            reload()
          }}
        />
      )}
    </>
  )
}

function UserFormModal({ user, isSelf, onClose, onSaved }: { user?: User; isSelf: boolean; onClose: () => void; onSaved: () => void }) {
  const form = useForm(
    {
      name: user?.name ?? '',
      email: user?.email ?? '',
      role: user?.role ?? 'worker',
      password: '',
      is_active: user?.is_active ?? true,
    },
    {
      validate: (v) =>
        collectErrors([
          ['name', rules.required(v.name)],
          ['email', rules.required(v.email) ?? rules.email(v.email)],
          ['password', (!user || v.password) && (v.password.length < 8 ? 'Hasło musi mieć co najmniej 8 znaków.' : null)],
        ]),
      onSubmit: async (v) => {
        const payload = { ...v, password: v.password || undefined }
        if (user) await api.patch(`/users/${user.id}`, payload)
        else await api.post('/users', payload)
        onSaved()
      },
    },
  )

  return (
    <FormModal title={user ? `Edycja: ${user.name}` : 'Nowy użytkownik'} form={form} onClose={onClose}>
      <TextField form={form} name="name" label="Imię i nazwisko" required />
      <TextField form={form} name="email" label="E-mail" type="email" required autoComplete="off" />
      <SelectField
        form={form}
        name="role"
        label="Rola"
        disabled={isSelf}
        options={[
          { value: 'worker', label: 'Pracownik – produkty i ilości' },
          { value: 'manager', label: 'Kierownik zmiany – zatwierdzanie, raporty, usuwanie produktów' },
          { value: 'admin', label: 'Administrator – magazyny, sektory, użytkownicy' },
        ]}
      />
      <TextField
        form={form}
        name="password"
        label="Hasło"
        type="password"
        required={!user}
        autoComplete="new-password"
        hint={user ? 'Zostaw puste, aby nie zmieniać.' : 'Minimum 8 znaków.'}
      />
      {!isSelf && <CheckboxField form={form} name="is_active" label="Konto aktywne" />}
    </FormModal>
  )
}
