import { useNavigate } from 'react-router-dom'
import { Button } from '@/core/ui/Button'
import type { Sector } from '@/modules/warehouses'

/** Extension "sector.actions": print the QR label of the selected sector. */
export function SectorLabelAction({ sector }: { sector: Sector }) {
  const navigate = useNavigate()
  return (
    <Button size="sm" icon="qr" onClick={() => navigate(`/labels?sector=${sector.id}`)}>
      Etykieta QR
    </Button>
  )
}
