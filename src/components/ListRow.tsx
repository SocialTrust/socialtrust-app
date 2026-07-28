import type { ReactNode } from 'react'
import { ChevronRight } from 'lucide-react'

type ListRowProps = {
  leading?: ReactNode
  title: ReactNode
  subtitle?: ReactNode
  /** Right-hand value (amount, reputation, network name). */
  value?: ReactNode
  trailing?: ReactNode
  /** Renders a chevron and makes the whole row a button. */
  onClick?: () => void
  href?: string
  ariaLabel?: string
  tone?: 'default' | 'danger'
  disabled?: boolean
}

/**
 * The list row is the redesign's main building block: one tappable line with a
 * 44px minimum height, instead of every item becoming its own floating card.
 */
export function ListRow({ leading, title, subtitle, value, trailing, onClick, href, ariaLabel, tone = 'default', disabled }: ListRowProps) {
  const inner = (
    <>
      {leading ? <span className="listRowLeading">{leading}</span> : null}
      <span className="listRowCopy">
        <span className="listRowTitle">{title}</span>
        {subtitle ? <span className="listRowSubtitle">{subtitle}</span> : null}
      </span>
      {value !== undefined ? <span className="listRowValue">{value}</span> : null}
      {/* An explicit `trailing` — including `null` — always wins over the
          default chevron, so a non-navigating row can opt out of it. */}
      {trailing !== undefined ? trailing : (onClick || href ? <ChevronRight className="listRowChevron" size={18} aria-hidden="true" /> : null)}
    </>
  )

  const className = `listRow ${tone === 'danger' ? 'listRowDanger' : ''} ${onClick || href ? 'listRowInteractive' : ''}`

  if (href) {
    return (
      <a className={className} href={href} aria-label={ariaLabel} onClick={(event) => {
        if (!onClick) return
        if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
        event.preventDefault()
        onClick()
      }}>
        {inner}
      </a>
    )
  }

  if (onClick) {
    return (
      <button className={className} type="button" onClick={onClick} aria-label={ariaLabel} disabled={disabled}>
        {inner}
      </button>
    )
  }

  return <div className={className}>{inner}</div>
}
