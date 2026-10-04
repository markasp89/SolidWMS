import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Button } from '@/core/ui/Button'
import { useFeedback } from '@/core/ui/feedback'
import type { Sector, Warehouse } from '@/modules/warehouses'
import { stocktakingApi } from '../api'

/** Extension "sector.actions": count the selected sector (or continue its open stocktake). */
export function StartStocktakeButton({ sector }: { warehouse: Warehouse; sector: Sector }) {
  const navigate = useNavigate()
  const { toast } = useFeedback()
  const [busy, setBusy] = useState(false)

  const start = async () => {
    setBusy(true)
    try {
      const [open] = await stocktakingApi.list({ status: 'open', sector_id: sector.id })
      const target = open ?? (await stocktakingApi.create({ sector_id: sector.id }))
      navigate(`/stocktaking/${target.id}`)
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Nie udało się rozpocząć inwentaryzacji.', 'error')
      setBusy(false)
    }
  }

  return (
    <Button size="sm" icon="clipboard" loading={busy} onClick={start} title="Przelicz towar w tym sektorze">
      Inwentaryzuj
    </Button>
  )
}
