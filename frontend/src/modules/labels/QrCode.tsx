import { useEffect, useState } from 'react'

/** QR code rendered to an <img> (library loaded on demand). */
export function QrCode({ value, size = 160 }: { value: string; size?: number }) {
  const [src, setSrc] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    import('qrcode')
      .then((QR) => QR.toDataURL(value, { margin: 1, width: size * 2, errorCorrectionLevel: 'M' }))
      .then((url) => !cancelled && setSrc(url))
      .catch(() => !cancelled && setSrc(null))
    return () => {
      cancelled = true
    }
  }, [value, size])

  return src ? <img className="qr" src={src} width={size} height={size} alt={value} /> : <div className="qr qr-loading" style={{ width: size, height: size }} />
}
