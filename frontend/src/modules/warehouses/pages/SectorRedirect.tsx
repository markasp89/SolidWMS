import { Navigate, useParams } from 'react-router-dom'
import { useAsync } from '@/core/hooks/useAsync'
import { ErrorMessage, Spinner } from '@/core/ui/misc'
import { warehousesApi } from '../api'

/** /sectors/:id (e.g. from a scanned QR label) → the sector on its warehouse map. */
export function SectorRedirect() {
  const { id } = useParams()
  const { data, error } = useAsync((signal) => warehousesApi.sector(id!, signal), [id])

  if (error) return <ErrorMessage error={error} />
  if (!data) return <Spinner />
  return <Navigate to={`/warehouses/${data.warehouse_id}?sector=${data.id}`} replace />
}
