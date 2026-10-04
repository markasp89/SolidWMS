import { useState } from 'react'
import { PageHeader } from '@/core/ui/misc'
import { ApiKeysTab } from './ApiKeysTab'
import { DocsTab } from './DocsTab'
import { WebhooksTab } from './WebhooksTab'

type Tab = 'keys' | 'webhooks' | 'docs'

const TABS: Array<[Tab, string]> = [
  ['keys', 'Klucze API'],
  ['webhooks', 'Webhooki'],
  ['docs', 'Dokumentacja'],
]

export function IntegrationsPage() {
  const [tab, setTab] = useState<Tab>('keys')

  return (
    <>
      <PageHeader
        title="Integracje"
        subtitle="Połączenia z innymi systemami: programem księgowym, ERP, sklepem internetowym."
      />
      <div className="tabs integrations-tabs" role="tablist">
        {TABS.map(([value, label]) => (
          <button
            key={value}
            type="button"
            role="tab"
            id={`integrations-tab-${value}`}
            aria-selected={tab === value}
            aria-controls="integrations-panel"
            className={tab === value ? 'is-active' : ''}
            onClick={() => setTab(value)}
          >
            {label}
          </button>
        ))}
      </div>
      <div id="integrations-panel" role="tabpanel" aria-labelledby={`integrations-tab-${tab}`} className="integrations-panel">
        {tab === 'keys' && <ApiKeysTab />}
        {tab === 'webhooks' && <WebhooksTab />}
        {tab === 'docs' && <DocsTab />}
      </div>
    </>
  )
}
