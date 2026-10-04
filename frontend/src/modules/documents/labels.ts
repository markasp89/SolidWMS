import type { DocumentType } from './types'

export const TYPE_LABELS: Record<DocumentType, string> = {
  PZ: 'Przyjęcie zewnętrzne',
  WZ: 'Wydanie zewnętrzne',
}

export const counterpartyLabel = (type: DocumentType) => (type === 'PZ' ? 'Dostawca' : 'Odbiorca')
