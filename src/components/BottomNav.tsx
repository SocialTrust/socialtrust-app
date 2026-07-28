import type { MouseEvent } from 'react'
import { Activity, House, User, Users } from 'lucide-react'
import { TAB_PATHS, type TabKey } from '../lib/routes'

type BottomNavProps = {
  activeTab?: TabKey
  onNavigate: (path: string) => void
  /** A modal sheet owns the screen: the bar stays visible but stops taking input. */
  inactive?: boolean
  /** Genuinely full-screen experiences (live QR camera) hide the bar entirely. */
  hidden?: boolean
}

const TABS: { key: TabKey; label: string; Icon: typeof House }[] = [
  { key: 'home', label: 'Home', Icon: House },
  { key: 'friends', label: 'Friends', Icon: Users },
  { key: 'activity', label: 'Activity', Icon: Activity },
  { key: 'account', label: 'Account', Icon: User },
]

export function BottomNav({ activeTab, onNavigate, inactive, hidden }: BottomNavProps) {
  if (hidden) return null

  // Real anchors: direct links, middle-click, and "open in new tab" keep
  // working, while a plain left click is handled by the in-app router.
  const handleClick = (path: string) => (event: MouseEvent<HTMLAnchorElement>) => {
    if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
    event.preventDefault()
    onNavigate(path)
  }

  return (
    <nav
      className="bottomNav"
      aria-label="Primary"
      aria-hidden={inactive || undefined}
      inert={inactive || undefined}
    >
      <ul className="bottomNavList">
        {TABS.map(({ key, label, Icon }) => {
          const path = TAB_PATHS[key]
          const active = activeTab === key
          return (
            <li key={key}>
              <a
                className={`bottomNavItem ${active ? 'isActive' : ''}`}
                href={path}
                aria-current={active ? 'page' : undefined}
                onClick={handleClick(path)}
              >
                <Icon size={21} aria-hidden="true" strokeWidth={active ? 2.4 : 1.9} />
                <span>{label}</span>
              </a>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
