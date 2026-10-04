import { useState } from 'react'
import { formatDateTime, formatRelative } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { CheckboxField, collectErrors, FormModal, rules, TextField, useForm } from '@/core/ui/form'
import { EmptyState, ErrorMessage, Spinner } from '@/core/ui/misc'
import { Modal } from '@/core/ui/Modal'
import {
  ALL_EVENTS,
  integrationsApi,
  isSuccessful,
  type Webhook,
  type WebhookDelivery,
  type WebhookEvent,
  type WebhookPayload,
} from './api'
import { CheckboxGroup, SecretModal } from './components'

const toPayload = (webhook: Webhook, patch: Partial<WebhookPayload> = {}): WebhookPayload => ({
  name: webhook.name,
  url: webhook.url,
  events: webhook.events,
  active: webhook.active,
  ...patch,
})

const isHttpUrl = (value: string) => {
  try {
    const url = new URL(value.trim())
    return (url.protocol === 'http:' || url.protocol === 'https:') && url.hostname !== ''
  } catch {
    return false
  }
}

export function WebhooksTab() {
  const { toast, confirm } = useFeedback()
  const [editing, setEditing] = useState<Webhook | 'new' | null>(null)
  const [secret, setSecret] = useState<{ webhook: Webhook; value: string; fresh: boolean } | null>(null)
  const [history, setHistory] = useState<Webhook | null>(null)
  const [busy, setBusy] = useState<Record<number, 'active' | 'test' | 'secret' | undefined>>({})
  const { data, error, loading, reload, setData } = useAsync((signal) => integrationsApi.webhooks(signal), [])
  const events = useAsync((signal) => integrationsApi.events(signal), [])

  const eventLabels = new Map((events.data ?? []).map((e) => [e.key, e.label]))

  const withBusy = async (id: number, action: 'active' | 'test' | 'secret', run: () => Promise<void>) => {
    setBusy((prev) => ({ ...prev, [id]: action }))
    try {
      await run()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy((prev) => ({ ...prev, [id]: undefined }))
    }
  }

  const toggleActive = (webhook: Webhook, active: boolean) =>
    withBusy(webhook.id, 'active', async () => {
      const updated = await integrationsApi.updateWebhook(webhook.id, toPayload(webhook, { active }))
      setData((prev) => (prev ?? []).map((w) => (w.id === webhook.id ? { ...w, active: updated.active } : w)))
      toast(active ? 'Webhook włączony.' : 'Webhook wyłączony.')
    })

  const test = (webhook: Webhook) =>
    withBusy(webhook.id, 'test', async () => {
      const delivery = await integrationsApi.testWebhook(webhook.id)
      if (isSuccessful(delivery)) {
        toast(`Test udany: HTTP ${delivery.status_code}, ${delivery.duration_ms} ms.`)
      } else {
        const status = delivery.status_code ? `HTTP ${delivery.status_code}` : 'brak odpowiedzi'
        toast(`Test nieudany (${status}, ${delivery.duration_ms} ms)${delivery.error ? `: ${delivery.error}` : '.'}`, 'error')
      }
      reload()
    })

  const showSecret = (webhook: Webhook) =>
    withBusy(webhook.id, 'secret', async () => {
      const { secret: value } = await integrationsApi.secret(webhook.id)
      setSecret({ webhook, value, fresh: false })
    })

  const remove = async (webhook: Webhook) => {
    const ok = await confirm({
      title: 'Usunąć webhook?',
      message: `Webhook „${webhook.name}” przestanie otrzymywać powiadomienia, a jego historia wysyłek zostanie usunięta.`,
      confirmLabel: 'Usuń',
      danger: true,
    })
    if (!ok) return
    try {
      await integrationsApi.deleteWebhook(webhook.id)
      toast('Webhook usunięty.')
      reload()
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <>
      <div className="integrations-toolbar">
        <p className="muted">
          Webhook to adres URL, pod który SolidWMS wysyła powiadomienie (POST z JSON-em) zaraz po wybranym zdarzeniu w
          magazynie.
        </p>
        <Button variant="primary" icon="plus" onClick={() => setEditing('new')}>
          Nowy webhook
        </Button>
      </div>

      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && (
        <EmptyState icon="bell" title="Brak webhooków">
          Dodaj webhook, aby inny system dowiadywał się o zmianach w magazynie bez odpytywania API.
        </EmptyState>
      )}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table webhooks-table">
            <thead>
              <tr>
                <th>Nazwa</th>
                <th>Zdarzenia</th>
                <th>Aktywny</th>
                <th>Ostatnia wysyłka</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.map((webhook) => (
                <tr key={webhook.id}>
                  <td>
                    <strong>{webhook.name}</strong>
                    <div className="webhook-url muted" title={webhook.url}>
                      {webhook.url}
                    </div>
                  </td>
                  <td>
                    <span className="badge-list">
                      {webhook.events.map((key) => (
                        <span key={key} className="badge" title={eventLabels.get(key)}>
                          {key === ALL_EVENTS ? 'wszystkie' : key}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td>
                    <label className="checkbox webhook-active">
                      <input
                        type="checkbox"
                        checked={webhook.active}
                        disabled={busy[webhook.id] === 'active'}
                        onChange={(e) => toggleActive(webhook, e.target.checked)}
                        aria-label={`Webhook ${webhook.name} aktywny`}
                      />
                      <span>{webhook.active ? 'Tak' : 'Nie'}</span>
                    </label>
                  </td>
                  <td className="nowrap">
                    <DeliveryStatus delivery={webhook.last_delivery} />
                  </td>
                  <td className="actions">
                    <div className="webhook-actions">
                      <Button size="sm" icon="refresh" loading={busy[webhook.id] === 'test'} onClick={() => test(webhook)}>
                        Testuj
                      </Button>
                      <Button size="sm" icon="history" onClick={() => setHistory(webhook)}>
                        Historia
                      </Button>
                      <Button size="sm" variant="ghost" loading={busy[webhook.id] === 'secret'} onClick={() => showSecret(webhook)}>
                        Pokaż sekret
                      </Button>
                      <Button size="sm" icon="edit" variant="ghost" onClick={() => setEditing(webhook)} aria-label="Edytuj" title="Edytuj" />
                      <Button size="sm" icon="trash" variant="ghost" onClick={() => remove(webhook)} aria-label="Usuń" title="Usuń" />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {editing && (
        <WebhookFormModal
          webhook={editing === 'new' ? undefined : editing}
          events={events.data}
          eventsError={events.error}
          onClose={() => setEditing(null)}
          onSaved={(saved) => {
            setEditing(null)
            toast('Zapisano.')
            if (saved.secret) setSecret({ webhook: saved, value: saved.secret, fresh: true })
            reload()
          }}
        />
      )}

      {secret && (
        <SecretModal
          title={`Sekret webhooka: ${secret.webhook.name}`}
          value={secret.value}
          onClose={() => setSecret(null)}
          warning={
            secret.fresh ? (
              <>
                <strong>Zapisz sekret w systemie odbierającym.</strong> Służy do weryfikacji podpisu{' '}
                <code>X-SolidWMS-Signature</code>. Później możesz go wyświetlić akcją „Pokaż sekret”.
              </>
            ) : undefined
          }
        >
          {!secret.fresh && (
            <p className="muted">
              Sekret służy do weryfikacji podpisu <code>X-SolidWMS-Signature</code> (HMAC-SHA256 treści żądania). Nie
              udostępniaj go osobom trzecim.
            </p>
          )}
        </SecretModal>
      )}

      {history && <DeliveriesModal webhook={history} onClose={() => setHistory(null)} />}
    </>
  )
}

function DeliveryStatus({ delivery }: { delivery: WebhookDelivery | null }) {
  if (!delivery) return <span className="muted">—</span>
  const ok = isSuccessful(delivery)
  return (
    <span className="delivery-status" title={delivery.error ?? undefined}>
      <span className={`badge ${ok ? 'badge-in' : 'badge-out'}`}>{delivery.status_code ?? 'błąd'}</span>
      <span className="muted" title={formatDateTime(delivery.created_at)}>
        {formatRelative(delivery.created_at)}
      </span>
    </span>
  )
}

function WebhookFormModal({
  webhook,
  events,
  eventsError,
  onClose,
  onSaved,
}: {
  webhook?: Webhook
  events: WebhookEvent[] | undefined
  eventsError: Error | null
  onClose: () => void
  onSaved: (webhook: Webhook) => void
}) {
  const form = useForm(
    {
      name: webhook?.name ?? '',
      url: webhook?.url ?? '',
      all: webhook?.events.includes(ALL_EVENTS) ?? false,
      events: webhook?.events.filter((e) => e !== ALL_EVENTS) ?? ([] as string[]),
      active: webhook?.active ?? true,
    },
    {
      validate: (v) =>
        collectErrors([
          ['name', rules.required(v.name)],
          ['url', rules.required(v.url) ?? (isHttpUrl(v.url) ? null : 'Podaj poprawny adres zaczynający się od http:// lub https://.')],
          ['events', !v.all && v.events.length === 0 && 'Wybierz co najmniej jedno zdarzenie.'],
        ]),
      onSubmit: async (v) => {
        const payload: WebhookPayload = {
          name: v.name.trim(),
          url: v.url.trim(),
          events: v.all ? [ALL_EVENTS] : v.events,
          active: v.active,
        }
        onSaved(webhook ? await integrationsApi.updateWebhook(webhook.id, payload) : await integrationsApi.createWebhook(payload))
      },
    },
  )

  return (
    <FormModal title={webhook ? `Edycja: ${webhook.name}` : 'Nowy webhook'} form={form} onClose={onClose} size="lg">
      <div className="form-row">
        <TextField form={form} name="name" label="Nazwa" required maxLength={100} autoComplete="off" />
        <TextField
          form={form}
          name="url"
          label="Adres URL"
          type="url"
          required
          maxLength={2048}
          placeholder="https://erp.example.com/solidwms/webhook"
          autoComplete="off"
        />
      </div>
      <div className="field field-checkbox">
        <label className="checkbox">
          <input
            type="checkbox"
            name="all"
            checked={form.values.all}
            onChange={(e) => {
              form.set('all', e.target.checked)
              if (form.errors.events) form.setErrors(collectErrors(Object.entries(form.errors).filter(([key]) => key !== 'events')))
            }}
          />
          <span>Wszystkie zdarzenia (również dodane w przyszłości)</span>
        </label>
      </div>
      {eventsError && <ErrorMessage error={eventsError} />}
      {!events && !eventsError && <Spinner label="Ładowanie listy zdarzeń…" />}
      {events && (
        <CheckboxGroup
          legend="Zdarzenia"
          name="events"
          options={events.map((e) => ({
            value: e.key,
            label: (
              <>
                <code>{e.key}</code> <span className="muted">– {e.label}</span>
              </>
            ),
          }))}
          value={form.values.all ? events.map((e) => e.key) : form.values.events}
          disabled={form.values.all}
          onChange={(selected) => form.set('events', selected)}
          error={form.errors.events}
        />
      )}
      <CheckboxField form={form} name="active" label="Aktywny – wysyłaj powiadomienia" />
      {!webhook && (
        <p className="field-hint">Po zapisaniu zostanie wygenerowany sekret do weryfikacji podpisu powiadomień.</p>
      )}
    </FormModal>
  )
}

function DeliveriesModal({ webhook, onClose }: { webhook: Webhook; onClose: () => void }) {
  const { data, error, loading, reload } = useAsync((signal) => integrationsApi.deliveries(webhook.id, signal), [webhook.id])

  return (
    <Modal
      open
      size="lg"
      title={`Historia wysyłek: ${webhook.name}`}
      onClose={onClose}
      footer={
        <>
          <div className="modal-footer-start">
            <Button icon="refresh" onClick={reload} loading={loading}>
              Odśwież
            </Button>
          </div>
          <Button variant="primary" onClick={onClose}>
            Zamknij
          </Button>
        </>
      }
    >
      {error && <ErrorMessage error={error} onRetry={reload} />}
      {loading && !data && <Spinner />}
      {data && data.length === 0 && <EmptyState icon="clock" title="Brak wysyłek" />}
      {data && data.length > 0 && (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>Data</th>
                <th>Zdarzenie</th>
                <th>Status</th>
                <th>Czas</th>
                <th>Błąd</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, index) => (
                <tr key={d.id ?? index}>
                  <td className="nowrap">{formatDateTime(d.created_at)}</td>
                  <td>
                    <code>{d.event}</code>
                  </td>
                  <td>
                    <span className={`badge ${isSuccessful(d) ? 'badge-in' : 'badge-out'}`}>{d.status_code ?? 'błąd'}</span>
                  </td>
                  <td className="nowrap">{d.duration_ms} ms</td>
                  <td className="delivery-error">{d.error ?? <span className="muted">—</span>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Modal>
  )
}
