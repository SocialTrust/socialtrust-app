import { useCallback, useEffect, useId, useRef, type ReactNode } from 'react'
import { X } from 'lucide-react'

type SheetProps = {
  open: boolean
  title: string
  description?: string
  header?: ReactNode
  footer?: ReactNode
  children: ReactNode
  onClose: () => void
  /**
   * A transaction is being submitted. Escape and backdrop taps stop closing the
   * sheet, because dismissing mid-submit leaves the UI claiming nothing
   * happened while a wallet prompt is still live.
   */
  busy?: boolean
  /** Near-full-screen layout, used while the QR camera is running. */
  fullScreen?: boolean
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

// One shared counter: stacked sheets must not each try to own the body scroll
// lock, or closing the first one unlocks the page under the second.
let openSheetCount = 0

export function Sheet({ open, title, description, header, footer, children, onClose, busy, fullScreen }: SheetProps) {
  const panelRef = useRef<HTMLElement | null>(null)
  const restoreFocusRef = useRef<HTMLElement | null>(null)
  const busyRef = useRef(busy)
  busyRef.current = busy
  const titleId = useId()

  const requestClose = useCallback(() => {
    if (busyRef.current) return
    onClose()
  }, [onClose])

  // Scroll locking: iOS keeps scrolling the page behind a fixed overlay unless
  // the body itself stops scrolling.
  useEffect(() => {
    if (!open) return
    openSheetCount += 1
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.body.classList.add('sheetOpen')
    return () => {
      openSheetCount = Math.max(0, openSheetCount - 1)
      if (openSheetCount === 0) {
        document.body.style.overflow = previousOverflow
        document.body.classList.remove('sheetOpen')
      }
    }
  }, [open])

  // Focus moves into the sheet on open and returns to the trigger on close, so
  // keyboard focus is never left stranded behind an open sheet.
  useEffect(() => {
    if (!open) return
    restoreFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const panel = panelRef.current
    const first = panel?.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel)?.focus?.()
    return () => {
      restoreFocusRef.current?.focus?.()
      restoreFocusRef.current = null
    }
  }, [open])

  useEffect(() => {
    if (!open) return

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        requestClose()
        return
      }
      if (event.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
      if (focusable.length === 0) return

      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      const active = document.activeElement

      if (!active || !panel.contains(active)) {
        event.preventDefault()
        first.focus()
        return
      }
      if (event.shiftKey && active === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && active === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => document.removeEventListener('keydown', onKeyDown)
  }, [open, requestClose])

  if (!open) return null

  return (
    <div className={`sheetLayer ${fullScreen ? 'sheetLayerFull' : ''}`}>
      <div className="sheetBackdrop" onClick={requestClose} aria-hidden="true" />
      <section
        ref={panelRef}
        className={`sheetPanel ${fullScreen ? 'sheetPanelFull' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
      >
        <div className="sheetGrabber" aria-hidden="true" />
        <header className="sheetHeader">
          <div className="sheetHeading">
            {header ? (
              <>
                <span id={titleId} className="visuallyHidden">{title}</span>
                {header}
              </>
            ) : (
              <>
                <h2 id={titleId}>{title}</h2>
                {description ? <p>{description}</p> : null}
              </>
            )}
          </div>
          <button className="iconButton sheetClose" type="button" aria-label="Close" onClick={requestClose}>
            <X size={18} />
          </button>
        </header>
        <div className="sheetBody">{children}</div>
        {footer ? <div className="sheetFooter">{footer}</div> : null}
      </section>
    </div>
  )
}
