import { useNavigate } from 'react-router-dom'
import { parseCode } from '@/core/codes'
import { ScanButton } from '@/core/ui/Scanner'

/** Topbar button: scan any SolidWMS label or product barcode and jump to it. */
export function ScanAction() {
  const navigate = useNavigate()

  const open = (text: string) => {
    const target = parseCode(text)
    switch (target.kind) {
      case 'sector':
        navigate(`/sectors/${target.id}`)
        break
      case 'pallet':
        navigate(`/pallets/${encodeURIComponent(target.code)}`)
        break
      case 'product':
        navigate(`/search?q=${encodeURIComponent(target.sku)}`)
        break
      default:
        navigate(`/search?q=${encodeURIComponent(target.value)}`)
    }
  }

  return (
    <ScanButton
      onScan={open}
      title="Skanuj kod"
      hint="Etykieta sektora lub palety otworzy jej miejsce, kod produktu – wyszukiwarkę."
    />
  )
}
