import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from './Icon'

interface ModalProps {
  open: boolean
  title: ReactNode
  onClose: () => void
  children: ReactNode
  /** Buttons rendered in the modal footer. */
  footer?: ReactNode
  size?: 'sm' | 'md' | 'lg'
  /** Prevent closing with Escape / backdrop click (e.g. while saving). */
  locked?: boolean
}

export function Modal({ open, title, onClose, children, footer, size = 'md', locked = false }: ModalProps) {
  const titleId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const previouslyFocused = document.activeElement as HTMLElement | null
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !locked) onClose()
    }
    document.addEventListener('keydown', onKey)
    document.body.classList.add('modal-open')

    // Focus the first form control, or the dialog itself.
    const focusable = dialogRef.current?.querySelector<HTMLElement>(
      'input:not([type=hidden]):not([disabled]), select, textarea, [data-autofocus]',
    )
    ;(focusable ?? dialogRef.current)?.focus()

    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.classList.remove('modal-open')
      previouslyFocused?.focus?.()
    }
  }, [open, locked, onClose])

  if (!open) return null

  return createPortal(
    <div className="modal-backdrop" onMouseDown={(e) => e.target === e.currentTarget && !locked && onClose()}>
      <div
        ref={dialogRef}
        className={`modal modal-${size}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <header className="modal-header">
          <h2 id={titleId}>{title}</h2>
          <button type="button" className="modal-close" onClick={onClose} disabled={locked} aria-label="Zamknij">
            <Icon name="close" />
          </button>
        </header>
        <div className="modal-body">{children}</div>
        {footer && <footer className="modal-footer">{footer}</footer>}
      </div>
    </div>,
    document.body,
  )
}
