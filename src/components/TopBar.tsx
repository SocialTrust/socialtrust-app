import type { ReactNode } from 'react'

type TopBarProps = {
  /** Rendered on the left: a title, a wordmark, or a back button + title. */
  left?: ReactNode
  title?: string
  /** Real, implemented actions only. */
  actions?: ReactNode
  children?: ReactNode
}

/**
 * Compact sticky header shared by every screen. It sticks to the top of the app
 * viewport, pays back `env(safe-area-inset-top)`, and stays around 54px tall so
 * it never turns into a desktop navigation header.
 */
export function TopBar({ left, title, actions, children }: TopBarProps) {
  return (
    <header className="topBar">
      <div className="topBarInner">
        <div className="topBarLeft">
          {left}
          {title ? <h1 className="topBarTitle">{title}</h1> : null}
        </div>
        {children}
        {actions ? <div className="topBarActions">{actions}</div> : null}
      </div>
    </header>
  )
}
