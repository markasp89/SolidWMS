import { useState } from 'react'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { Card, PageHeader } from '@/core/ui/misc'
import { settingsApi, type ImportSummary } from './api'
import { ImportModal } from './ImportModal'
import { ModulesPanel } from './ModulesPanel'

export function SettingsPage() {
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

      <ModulesPanel />

      <h2 className="section-title">Dane</h2>
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
                    ['Piętra', summary.floors],
                    ['Sektory', summary.sectors],
                    ['Produkty', summary.products],
                    ['Palety', summary.pallets],
                    ['Lokalizacje', summary.stock],
                  ] as const
                ).map(([label, s]) => (
                  <li key={label}>
                    {label}: {s?.created ?? 0} nowych, {s?.updated ?? 0} zaktualizowanych
                  </li>
                ))}
                <li>Rzuty magazynów: {summary.floor_plans.imported}</li>
              </ul>
            </div>
          )}
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
