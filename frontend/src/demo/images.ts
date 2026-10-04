/**
 * Uploaded images are scaled down (longest side 1200 px) and kept as data URLs
 * so they fit into localStorage.
 */
import { invalid } from './http'
import type { ImageRef } from './types'

const MAX_SIDE = 1200
const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif']

/** Reads an uploaded file field; 422 when it is missing or not an image. */
export async function readImage(form: FormData | null, field: string, invalidMessage: string): Promise<ImageRef> {
  const file = form?.get(field)
  if (!(file instanceof Blob) || file.size === 0) invalid(field, `Pole ${field === 'photo' ? 'zdjęcie' : 'rzut'} jest wymagane.`)
  if (file.type && !ACCEPTED.includes(file.type)) invalid(field, invalidMessage)

  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file)
  } catch {
    invalid(field, invalidMessage)
  }

  try {
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    const width = Math.max(1, Math.round(bitmap.width * scale))
    const height = Math.max(1, Math.round(bitmap.height * scale))
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const context = canvas.getContext('2d')
    if (!context) return { url: await blobToDataUrl(file), width: bitmap.width, height: bitmap.height }
    context.drawImage(bitmap, 0, 0, width, height)
    // PNG keeps sharp line drawings (floor plans) small; photos compress better as JPEG.
    const png = file.type === 'image/png' || file.type === 'image/gif'
    let url = png ? canvas.toDataURL('image/png') : canvas.toDataURL('image/jpeg', 0.82)
    if (png && url.length > 900_000) url = canvas.toDataURL('image/jpeg', 0.85)
    return { url, width, height }
  } finally {
    bitmap.close()
  }
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(blob)
  })
}
