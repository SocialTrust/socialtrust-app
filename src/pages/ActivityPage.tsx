import type { Address } from 'viem'
import type { UserSnapshot } from '../types'
import { ActivityList } from '../components/ActivityList'

type ActivityPageProps = {
  isConnected: boolean
  snapshot?: UserSnapshot
  isLoading: boolean
  /** Set when the indexed activity query failed; the list is not silently faked. */
  activityError?: string
  nowSeconds: number
  onConnect: () => void
  onRetry: () => void
  onNavigate: (path: string) => void
}

export function ActivityPage({
  isConnected,
  snapshot,
  isLoading,
  activityError,
  nowSeconds,
  onConnect,
  onRetry,
  onNavigate,
}: ActivityPageProps) {
  if (!isConnected) {
    return (
      <div className="pageStack">
        <section className="emptyPanel">
          <h2>Connect to see your activity</h2>
          <p>Deposits, invites, challenges, steals, matches, and finalized friendships appear here.</p>
          <button className="primaryButton full" type="button" onClick={onConnect}>Connect wallet</button>
        </section>
      </div>
    )
  }

  const items = snapshot?.recentActivity ?? []
  const navigateAccount = (address: Address) => onNavigate(`/account/${address}`)

  if (activityError && items.length === 0) {
    return (
      <div className="pageStack">
        <section className="emptyPanel emptyPanelError">
          <h2>Could not load activity</h2>
          <p>{activityError}</p>
          <button className="secondaryButton full" type="button" onClick={onRetry}>Try again</button>
        </section>
      </div>
    )
  }

  if (items.length === 0 && isLoading) {
    return (
      <div className="pageStack">
        <div className="listGroup" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((index) => <div key={index} className="skeletonRow" />)}
        </div>
        <p className="emptyNote" role="status">Loading activity…</p>
      </div>
    )
  }

  if (items.length === 0) {
    return (
      <div className="pageStack">
        <section className="emptyPanel">
          <h2>No activity yet</h2>
          <p>Deposits, invites, challenges, steals, matches, and finalized friendships will appear here.</p>
        </section>
      </div>
    )
  }

  return (
    <div className="pageStack">
      {activityError ? (
        <p className="inlineWarning" role="status">
          Showing the last indexed activity. {activityError}{' '}
          <button className="linkButton" type="button" onClick={onRetry}>Retry</button>
        </p>
      ) : null}
      <section className="section">
        <ActivityList
          items={items}
          profiles={snapshot?.friendProfiles}
          onNavigateAccount={navigateAccount}
          nowSeconds={nowSeconds}
        />
      </section>
    </div>
  )
}
