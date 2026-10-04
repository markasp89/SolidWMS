import { useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { formatDateTime, formatNumber } from '@/core/format'
import { useAsync } from '@/core/hooks/useAsync'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import { ColorDot, ErrorMessage, PageHeader, Spinner } from '@/core/ui/misc'
import { ExpiryBadge, notifyStockChanged } from '@/modules/inventory'
import { documentsApi } from '../api'
import { StatusBadge, TypeBadge } from '../components/badges'
import { counterpartyLabel, TYPE_LABELS } from '../labels'
import type { DocumentDetail, DocumentLine } from '../types'

export function DocumentViewPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const { toast, confirm } = useFeedback()
  const { data: doc, error, loading, reload, setData } = useAsync((signal) => documentsApi.get(Number(id), signal), [id])
  const [busy, setBusy] = useState<'post' | 'delete' | 'pdf' | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)

  if (error) return <ErrorMessage error={error} onRetry={reload} />
  if (loading || !doc) return <Spinner />

  const run = async (action: 'post' | 'delete' | 'pdf', fn: () => Promise<void>) => {
    setBusy(action)
    setActionError(null)
    try {
      await fn()
    } catch (e) {
      const message = e instanceof Error ? e.message : 'Wystąpił nieoczekiwany błąd.'
      setActionError(message)
      toast(message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const post = async () => {
    const ok = await confirm({
      title: `Zatwierdzić ${doc.number}?`,
      message:
        doc.type === 'PZ'
          ? `Towar z ${doc.lines.length} poz. zostanie przyjęty na stan wskazanych sektorów. Zatwierdzonego dokumentu nie można zmienić.`
          : `Towar z ${doc.lines.length} poz. zostanie wydany z magazynu (najpierw najkrótszy termin ważności). Zatwierdzonego dokumentu nie można zmienić.`,
      confirmLabel: 'Zatwierdź',
    })
    if (!ok) return
    await run('post', async () => {
      setData(await documentsApi.post(doc.id))
      notifyStockChanged()
      toast(`Zatwierdzono ${doc.number}.`)
    })
  }

  const remove = async () => {
    const ok = await confirm({ title: `Usunąć ${doc.number}?`, message: 'Szkic dokumentu zostanie trwale usunięty.', confirmLabel: 'Usuń', danger: true })
    if (!ok) return
    await run('delete', async () => {
      await documentsApi.remove(doc.id)
      toast(`Usunięto ${doc.number}.`)
      navigate('/documents', { replace: true })
    })
  }

  const isDraft = doc.status === 'draft'

  return (
    <>
      <PageHeader
        back={
          <Link to="/documents" className="link-muted">
            ← Dokumenty
          </Link>
        }
        title={
          <span className="doc-title">
            {doc.number} <StatusBadge status={doc.status} />
          </span>
        }
        subtitle={
          <>
            <TypeBadge type={doc.type} /> {TYPE_LABELS[doc.type]}
          </>
        }
        actions={
          <>
            <Button icon="download" loading={busy === 'pdf'} onClick={() => run('pdf', () => documentsApi.downloadPdf(doc))}>
              Pobierz PDF
            </Button>
            {isDraft && (
              <>
                <Button icon="edit" onClick={() => navigate(`/documents/${doc.id}/edit`)} disabled={busy !== null}>
                  Edytuj
                </Button>
                <Button icon="trash" variant="danger" loading={busy === 'delete'} disabled={busy !== null} onClick={remove}>
                  Usuń
                </Button>
                <Button icon="check" variant="primary" loading={busy === 'post'} disabled={busy !== null || doc.lines.length === 0} onClick={post}>
                  Zatwierdź
                </Button>
              </>
            )}
          </>
        }
      />

      {actionError && (
        <div className="alert alert-error" role="alert">
          {actionError}
        </div>
      )}
      {isDraft && (
        <div className="alert alert-info">
          To jest szkic – stan magazynu zmieni się dopiero po zatwierdzeniu dokumentu.
        </div>
      )}

      <section className="card">
        <div className="card-body">
          <dl className="doc-info">
            <Info label="Magazyn">{doc.warehouse ? `${doc.warehouse.code} – ${doc.warehouse.name}` : '—'}</Info>
            <Info label={counterpartyLabel(doc.type)}>{doc.counterparty || '—'}</Info>
            <Info label="Utworzono">
              {formatDateTime(doc.created_at)}
              {doc.created_by && <span className="muted"> · {doc.created_by.name}</span>}
            </Info>
            <Info label="Zatwierdzono">
              {doc.posted_at ? formatDateTime(doc.posted_at) : '—'}
              {doc.posted_by && <span className="muted"> · {doc.posted_by.name}</span>}
            </Info>
            {doc.note && (
              <Info label="Uwagi" wide>
                <span className="doc-note">{doc.note}</span>
              </Info>
            )}
          </dl>
        </div>
      </section>

      <LinesCard doc={doc} />
    </>
  )
}

function Info({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) {
  return (
    <div className={wide ? 'doc-info-wide' : undefined}>
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  )
}

function LinesCard({ doc }: { doc: DocumentDetail }) {
  const posted = doc.status === 'posted'
  const hasBatch = doc.lines.some((l) => l.batch || l.expires_at)

  return (
    <section className="card">
      <header className="card-header">
        <h2>Pozycje ({doc.lines.length})</h2>
      </header>
      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th className="num">Lp.</th>
              <th>Produkt</th>
              <th className="num">Ilość</th>
              <th>{posted ? (doc.type === 'PZ' ? 'Przyjęto do' : 'Wydano z') : doc.type === 'PZ' ? 'Sektor docelowy' : 'Lokalizacja'}</th>
              {hasBatch && <th>Partia / ważność</th>}
            </tr>
          </thead>
          <tbody>
            {doc.lines.map((line) => (
              <tr key={line.id}>
                <td className="num">{line.position}</td>
                <td>
                  <strong>{line.product?.name ?? '—'}</strong>
                  <div className="muted">{line.product?.sku}</div>
                  {line.note && <div className="muted">{line.note}</div>}
                </td>
                <td className="num nowrap">
                  {formatNumber(line.quantity)} {line.product?.unit}
                </td>
                <td>
                  <LineLocation line={line} type={doc.type} />
                </td>
                {hasBatch && (
                  <td>
                    {line.batch ?? <span className="muted">—</span>}
                    {line.expires_at && (
                      <div>
                        <ExpiryBadge date={line.expires_at} />
                      </div>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  )
}

function LineLocation({ line, type }: { line: DocumentLine; type: DocumentDetail['type'] }) {
  if (line.posted_locations?.length) {
    return (
      <ul className="doc-locations">
        {line.posted_locations.map((loc, i) => (
          <li key={i}>
            <span className="nowrap">{loc.label}</span>
            {line.posted_locations!.length > 1 && <span className="muted"> – {formatNumber(loc.quantity)}</span>}
          </li>
        ))}
      </ul>
    )
  }
  if (line.sector) {
    return (
      <span className="doc-sector">
        <ColorDot color={line.sector.color} />
        {line.sector.code}
        {line.slot && `-${line.slot}`}
      </span>
    )
  }
  return <span className="muted">{type === 'WZ' ? (line.stock_item_id ? 'wskazana lokalizacja' : 'automatycznie (FEFO)') : '—'}</span>
}
