import type { ReactNode } from 'react'
import { X } from 'lucide-react'

type SheetProps = {
  open: boolean
  title: string
  description?: string
  header?: ReactNode
  children: ReactNode
  onClose: () => void
}

export function Sheet({ open, title, description, header, children, onClose }: SheetProps) {
  if (!open) return null
  return (
    <div className="sheetLayer" role="dialog" aria-modal="true" aria-label={title}>
      <button className="sheetBackdrop" aria-label="Close" onClick={onClose} />
      <section className="sheetPanel">
        <header className="sheetHeader">
          {header ?? (
            <div>
              <h2>{title}</h2>
              {description ? <p>{description}</p> : null}
            </div>
          )}
          <button className="iconButton" aria-label="Close" onClick={onClose}><X size={18} /></button>
        </header>
        <div className="sheetBody">{children}</div>
      </section>
    </div>
  )
}
