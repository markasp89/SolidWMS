import { useState } from 'react'
import { Button } from '@/core/ui/Button'
import { Modal } from '@/core/ui/Modal'
import { Card } from '@/core/ui/misc'
import type { Product, StockItem } from '@/modules/inventory'
import { PhotoGallery } from './PhotoGallery'

/** "product.sidebar": photos of the product. */
export function ProductPhotos({ product }: { product: Product }) {
  return (
    <Card title="Zdjęcia produktu">
      <PhotoGallery subjectType="product" subjectId={product.id} />
    </Card>
  )
}

/** "pallet.sidebar": photos of the pallet. */
export function PalletPhotos({ pallet }: { pallet: { id: number } }) {
  return (
    <Card title="Zdjęcia palety">
      <PhotoGallery subjectType="pallet" subjectId={pallet.id} />
    </Card>
  )
}

/** "location.actions": photo of the exact place where the goods were left. */
export function LocationPhotoAction({ item }: { item: StockItem }) {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button size="sm" variant="ghost" icon="camera" onClick={() => setOpen(true)} title="Zdjęcia miejsca" aria-label="Zdjęcia miejsca" />
      {open && (
        <Modal open title={`Zdjęcia miejsca – ${item.product?.name ?? ''}`} onClose={() => setOpen(false)}>
          <PhotoGallery subjectType="stock_item" subjectId={item.id} emptyText="Zrób zdjęcie, jak odłożono towar – następna osoba szybciej go znajdzie." />
        </Modal>
      )}
    </>
  )
}
