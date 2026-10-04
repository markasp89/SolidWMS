import { api } from '@/core/api/client'

export type ApiAbility = 'read' | 'write'

export interface ApiKey {
  id: number
  name: string
  prefix: string
  abilities: ApiAbility[]
  last_used_at: string | null
  created_at: string | null
}

export interface CreatedApiKey {
  id: number
  name: string
  /** Plain key - returned only once, right after creation. */
  key: string
}

export interface WebhookEvent {
  key: string
  label: string
}

export interface WebhookDelivery {
  id?: number
  event: string
  status_code: number | null
  error: string | null
  duration_ms: number
  created_at: string | null
}

export interface Webhook {
  id: number
  name: string
  url: string
  events: string[]
  active: boolean
  /** Only filled in the response to the create request. */
  secret: string | null
  last_delivery: WebhookDelivery | null
  created_at: string | null
}

export interface WebhookPayload {
  name: string
  url: string
  events: string[]
  active: boolean
}

export const ALL_EVENTS = '*'

export const ABILITY_LABELS: Record<ApiAbility, string> = { read: 'odczyt', write: 'zapis' }

export const isSuccessful = (delivery: Pick<WebhookDelivery, 'status_code' | 'error'>) =>
  delivery.status_code !== null && delivery.status_code >= 200 && delivery.status_code < 300 && !delivery.error

export const integrationsApi = {
  events: (signal?: AbortSignal) => api.get<WebhookEvent[]>('/integrations/events', undefined, signal),

  keys: (signal?: AbortSignal) => api.get<ApiKey[]>('/integrations/api-keys', undefined, signal),
  createKey: (payload: { name: string; abilities: ApiAbility[] }) => api.post<CreatedApiKey>('/integrations/api-keys', payload),
  revokeKey: (id: number) => api.delete(`/integrations/api-keys/${id}`),

  webhooks: (signal?: AbortSignal) => api.get<Webhook[]>('/integrations/webhooks', undefined, signal),
  createWebhook: (payload: WebhookPayload) => api.post<Webhook>('/integrations/webhooks', payload),
  updateWebhook: (id: number, payload: WebhookPayload) => api.put<Webhook>(`/integrations/webhooks/${id}`, payload),
  deleteWebhook: (id: number) => api.delete(`/integrations/webhooks/${id}`),
  testWebhook: (id: number) => api.post<WebhookDelivery>(`/integrations/webhooks/${id}/test`),
  deliveries: (id: number, signal?: AbortSignal) =>
    api.get<WebhookDelivery[]>(`/integrations/webhooks/${id}/deliveries`, undefined, signal),
  secret: (id: number) => api.get<{ secret: string }>(`/integrations/webhooks/${id}/secret`),
}
