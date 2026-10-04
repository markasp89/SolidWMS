import { useState } from 'react'
import { formatDateTime, formatRelative } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { collectErrors, FormModal, rules, TextField, useForm } from '@/core/ui/form'
import { EmptyState, ErrorMessage, Spinner } from '@/core/ui/misc'
import { ABILITY_LABELS, integrationsApi, type ApiAbility, type ApiKey, type CreatedApiKey } from './api'
import { CheckboxGroup, SecretModal } from './components'

export function ApiKeysTab() {
  const { toast, confirm } = useFeedback()
  const [creating, setCreating] = useState(false)
  const [created, setCreated] = useState<CreatedApiKey | null>(null)
  const { data, error, loading, reload } = useAsync((signal) => integrationsApi.keys(signal), [])

  const revoke = async (key: ApiKey) => {
    const ok = await confirm({
      title: 'Unieważnić klucz API?',
      message: `Systemy korzystające z klucza „${key.name}” (${key.prefix}…) natychmiast stracą dostęp. Tej operacji nie można cofnąć.`,
      confirmLabel: 'Unieważnij',
      danger: true,
    })
    if (!ok) return
    try {
      await integrationsApi.revokeKey(key.id)
      toast('Klucz unieważniony.')
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <>
      <div className="integrations-toolbar">
        <p className="muted">
          Klucz API pozwala zewnętrznemu systemowi (np. programowi księgowemu) korzystać z API integracyjnego. Każdy system
          powinien mieć osobny klucz.
        </p>
        <Button variant="primary" icon="plus" onClick={() => setCreating(true)}>
          Nowy klucz
        </Button>
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && (
        <EmptyState icon="plug" title="Brak kluczy API">
          Utwórz klucz, aby połączyć SolidWMS z innym systemem.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Klucz</th>
                <th>Uprawnienia</th>
                <th>Ostatnie użycie</th>
                <th>Utworzono</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((key) => (
                <tr key={key.id}>
                  <td>{key.name}</td>
                  <td className="nowrap">
                    <code>{key.prefix}…</code>
                  </td>
                  <td>
                    <span className="badge-list">
                      {key.abilities.map((ability) => (
                        <span key={ability} className={`badge ${ability === 'write' ? 'badge-warn' : 'badge-move'}`}>
                          {ABILITY_LABELS[ability] ?? ability}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="nowrap" title={key.last_used_at ? formatDateTime(key.last_used_at) : undefined}>
                    {key.last_used_at ? formatRelative(key.last_used_at) : <span className="muted">nigdy</span>}
                  </td>
                  <td className="nowrap">{formatDateTime(key.created_at)}</td>
                  <td className="actions">
                    <Button size="sm" variant="ghost" icon="trash" onClick={() => revoke(key)}>
                      Unieważnij
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && (
        <ApiKeyFormModal
          onClose={() => setCreating(false)}
          onCreated={(key) => {
            setCreating(false)
            setCreated(key)
            reload()
          }}
        />
      )}

      {created && (
        <SecretModal
          title={`Klucz API: ${created.name}`}
          value={created.key}
          onClose={() => setCreated(null)}
          warning={
            <>
              <strong>Skopiuj klucz teraz.</strong> Ze względów bezpieczeństwa nie zostanie on już nigdy pokazany. W razie
              utraty unieważnij go i utwórz nowy.
            </>
          }
        >
          <p className="muted">
            Przekaż klucz w nagłówku <code>X-Api-Key</code> każdego żądania do API integracyjnego.
          </p>
        </SecretModal>
      )}
    </>
  )
}

const ABILITY_OPTIONS: Array<{ value: ApiAbility; label: string }> = [
  { value: 'read', label: 'Odczyt – produkty, stany, ruchy magazynowe' },
  { value: 'write', label: 'Zapis – dodawanie i aktualizacja produktów' },
]

function ApiKeyFormModal({ onClose, onCreated }: { onClose: () => void; onCreated: (key: CreatedApiKey) => void }) {
  const form = useForm(
    { name: '', abilities: ['read'] as ApiAbility[] },
    {
      validate: (v) =>
        collectErrors([
          ['name', rules.required(v.name)],
          ['abilities', v.abilities.length === 0 && 'Wybierz co najmniej jedno uprawnienie.'],
        ]),
      onSubmit: async (v) => onCreated(await integrationsApi.createKey({ name: v.name.trim(), abilities: v.abilities })),
    },
  )

  return (
    <FormModal title="Nowy klucz API" form={form} onClose={onClose} submitLabel="Utwórz klucz">
      <TextField
        form={form}
        name="name"
        label="Nazwa"
        required
        maxLength={100}
        autoComplete="off"
        hint="Np. „Subiekt GT – synchronizacja” – pomaga rozpoznać, kto korzysta z klucza."
      />
      <CheckboxGroup
        legend="Uprawnienia"
        name="abilities"
        options={ABILITY_OPTIONS}
        value={form.values.abilities}
        onChange={(abilities) => form.set('abilities', abilities)}
        error={form.errors.abilities}
      />
    </FormModal>
  )
}
