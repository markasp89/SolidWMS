import type { AppModule } from '@/core/modules/types'
import { DocumentEditorPage } from './pages/DocumentEditorPage'
import { DocumentListPage } from './pages/DocumentListPage'
import { DocumentViewPage } from './pages/DocumentViewPage'
import './documents.css'

export const documentsModule: AppModule = {
  key: 'documents',
  routes: [
    { path: '/documents', element: <DocumentListPage /> },
    { path: '/documents/new', element: <DocumentEditorPage /> },
    { path: '/documents/:id', element: <DocumentViewPage /> },
    { path: '/documents/:id/edit', element: <DocumentEditorPage /> },
  ],
  nav: [{ to: '/documents', label: 'Dokumenty PZ/WZ', icon: 'file', order: 50 }],
}

// Public API of the module for other modules.
export { documentsApi } from './api'
export type { DocumentDetail, DocumentLine, DocumentStatus, DocumentSummary, DocumentType } from './types'
