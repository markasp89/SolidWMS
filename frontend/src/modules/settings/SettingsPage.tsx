import { useState } from 'react'
import { useModules } from '@/core/modules/registry'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Card, PageHeader } from '@/core/ui/misc'
import { settingsApi, type ImportSummary } from './api'
import { ImportModal } from './ImportModal'

export function SettingsPage() {
  const modules = useModules()
  const { toast } = useFeedback()
  const [includeImages, setIncludeImages] = useState(true)
  const [exporting, setExporting] = useState(false)
  const [importing, setImporting] = useState(false)
  const [summary, setSummary] = useState<ImportSummary | null>(null)

  const download = async () => {
    setExporting(true)
    try {
      await settingsApi.download(includeImages)
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setExporting(false)
    }
  }

  return (
    <>
      <PageHeader title="Ustawienia" />

      <div className="settings-grid">
        <Card title="Eksport danych">
          <p className="muted">
            Zapisuje magazyny, sektory, produkty i ich lokalizacje do pliku JSON na dysku. Plik może służyć jako kopia
            zapasowa lub do przeniesienia danych na inną instalację.
          </p>
          <label className="checkbox">
            <input type="checkbox" checked={includeImages} onChange={(e) => setIncludeImages(e.target.checked)} />
            <span>Dołącz obrazy rzutów magazynów (większy plik)</span>
          </label>
          <div className="button-row">
            <Button variant="primary" icon="download" loading={exporting} onClick={download}>
              Pobierz plik JSON
            </Button>
          </div>
        </Card>

        <Card title="Import danych">
          <p className="muted">
            Wczytuje dane z pliku eksportu – przez przesłanie pliku lub wklejenie jego zawartości. Rekordy są dopasowywane
            po kodach, więc import można bezpiecznie powtarzać.
          </p>
          <div className="button-row">
            <Button icon="upload" onClick={() => setImporting(true)}>
              Importuj…
            </Button>
          </div>
          {summary && (
            <div className="alert alert-success">
              <strong>Import zakończony.</strong>
              <ul className="summary-list">
                {(
                  [
                    ['Magazyny', summary.warehouses],
                    ['Sektory', summary.sectors],
                    ['Produkty', summary.products],
                    ['Lokalizacje', summary.stock],
                  ] as const
                ).map(([label, s]) => (
                  <li key={label}>
                    {label}: {s.created} nowych, {s.updated} zaktualizowanych
                  </li>
                ))}
                <li>Rzuty magazynów: {summary.floor_plans.imported}</li>
              </ul>
            </div>
          )}
        </Card>

        <Card title="Moduły">
          <ul className="modules-list">
            {modules.map((m) => (
              <li key={m.id}>
                <strong>{m.name}</strong> <code>{m.id}</code>
                {m.description && <div className="muted">{m.description}</div>}
              </li>
            ))}
          </ul>
        </Card>
      </div>

      {importing && (
        <ImportModal
          onClose={() => setImporting(false)}
          onDone={(s) => {
            setImporting(false)
            setSummary(s)
            toast('Dane zaimportowane.')
          }}
        />
      )}
    </>
  )
}
