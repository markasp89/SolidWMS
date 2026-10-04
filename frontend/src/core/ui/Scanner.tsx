import { useEffect, useRef, useState, type FormEvent } from 'react'
import { isDemo } from '@/core/demo'
import { Button } from './Button'
import { Modal } from './Modal'

interface ScannerModalProps {
  title?: string
  hint?: string
  onResult: (text: string) => void
  onClose: () => void
}

/**
 * Reads barcodes and QR codes with the device camera (rear camera on phones).
 * A text field is always available as a fallback - also for USB/Bluetooth
 * barcode readers, which "type" the code followed by Enter.
 */
export function ScannerModal({ title = 'Skanuj kod', hint, onResult, onClose }: ScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [manual, setManual] = useState('')
  const done = useRef(false)

  useEffect(() => {
    let stop: (() => void) | undefined
    let cancelled = false

    const start = async () => {
      if (isDemo) {
        setError('W wersji demo aparat jest wyłączony. Wpisz kod poniżej, np. KART-40, CEM-25 albo SWMS:P:P-00001.')
        return
      }
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Ta przeglądarka nie daje dostępu do aparatu. Wpisz kod ręcznie lub użyj czytnika.')
        return
      }
      try {
        const { BrowserMultiFormatReader } = await import('@zxing/browser')
        if (cancelled || !videoRef.current) return
        const reader = new BrowserMultiFormatReader()
        const controls = await reader.decodeFromConstraints(
          { video: { facingMode: { ideal: 'environment' } } },
          videoRef.current,
          (result) => {
            if (result && !done.current) {
              done.current = true
              navigator.vibrate?.(80)
              onResult(result.getText())
            }
          },
        )
        stop = () => controls.stop()
        if (cancelled) stop()
      } catch (e) {
        const name = (e as Error).name
        setError(
          name === 'NotAllowedError'
            ? 'Brak zgody na użycie aparatu. Zezwól na dostęp w ustawieniach przeglądarki.'
            : name === 'NotFoundError' || name === 'OverconstrainedError'
              ? 'Nie znaleziono aparatu. Wpisz kod ręcznie lub użyj czytnika.'
              : 'Nie udało się uruchomić aparatu (wymagane połączenie HTTPS).',
        )
      }
    }

    void start()
    return () => {
      cancelled = true
      stop?.()
    }
  }, [onResult])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    if (manual.trim()) onResult(manual.trim())
  }

  return (
    <Modal open title={title} onClose={onClose} size="sm">
      <div className="scanner">
        {error ? (
          <div className="alert alert-warn">{error}</div>
        ) : (
          <div className="scanner-view">
            <video ref={videoRef} muted playsInline />
            <div className="scanner-frame" aria-hidden="true" />
          </div>
        )}
        {hint && <p className="muted scanner-hint">{hint}</p>}
        <form className="scanner-manual" onSubmit={submit}>
          <input
            className="input"
            placeholder="…lub wpisz / zeskanuj czytnikiem"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
            autoComplete="off"
            aria-label="Kod"
          />
          <Button type="submit" variant="primary">
            OK
          </Button>
        </form>
      </div>
    </Modal>
  )
}

/** Small camera button that opens the scanner. */
export function ScanButton({
  onScan,
  title = 'Skanuj kod',
  hint,
  label,
  size = 'md',
}: {
  onScan: (text: string) => void
  title?: string
  hint?: string
  label?: string
  size?: 'sm' | 'md'
}) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <Button
        icon="scan"
        size={size}
        variant={label ? 'secondary' : 'ghost'}
        onClick={() => setOpen(true)}
        title={title}
        aria-label={label ? undefined : title}
      >
        {label}
      </Button>
      {open && (
        <ScannerModal
          title={title}
          hint={hint}
          onClose={() => setOpen(false)}
          onResult={(text) => {
            setOpen(false)
            onScan(text)
          }}
        />
      )}
    </>
  )
}

