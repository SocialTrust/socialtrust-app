import type { Address } from 'viem'
import { UserPlus } from 'lucide-react'
import type { ChallengeView, SocialProfile, UserSnapshot } from '../types'
import { challengeSortScore, getChallengeState } from '../lib/challenges'
import { ChallengeRow } from '../components/ChallengeRow'
import { ListRow } from '../components/ListRow'
import { ProfileAvatar, displayNameFor, secondaryNameFor } from '../components/ProfileAvatar'

type FriendsPageProps = {
  isConnected: boolean
  snapshot?: UserSnapshot
  isLoading: boolean
  txPending?: boolean
  nowSeconds: number
  onConnect: () => void
  onStartFriendship: () => void
  onOpenChallenge: (challenge: ChallengeView) => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onNavigate: (path: string) => void
}

function friendProfileFor(profiles: Record<string, SocialProfile> | undefined, address: Address) {
  return profiles?.[address.toLowerCase()]
}

export function FriendsPage({
  isConnected,
  snapshot,
  isLoading,
  txPending,
  nowSeconds,
  onConnect,
  onStartFriendship,
  onOpenChallenge,
  onFinalize,
  onAccept,
  onReject,
  onCancel,
  onNavigate,
}: FriendsPageProps) {
  if (!isConnected) {
    return (
      <div className="pageStack">
        <section className="emptyPanel">
          <h2>Connect to see your friends</h2>
          <p>Your friendships and pending invites live on chain, tied to your wallet.</p>
          <button className="primaryButton full" type="button" onClick={onConnect}>Connect wallet</button>
        </section>
      </div>
    )
  }

  const pending = [...(snapshot?.challenges ?? [])]
    .filter((challenge) => getChallengeState(challenge, nowSeconds) !== 'unknown')
    .sort((a, b) => challengeSortScore(a, nowSeconds) - challengeSortScore(b, nowSeconds))
  const friends = snapshot?.friends ?? []

  return (
    <div className="pageStack">
      {pending.length > 0 ? (
        <section className="section">
          <div className="sectionHead">
            <h3 className="sectionTitle">In progress</h3>
            <span className="sectionNote">{pending.length}</span>
          </div>
          <div className="rowStack">
            {pending.map((challenge) => (
              <ChallengeRow
                key={challenge.pairKey}
                challenge={challenge}
                profile={friendProfileFor(snapshot?.friendProfiles, challenge.other)}
                appBalance={snapshot?.appBalance}
                nowSeconds={nowSeconds}
                busy={txPending}
                onOpen={onOpenChallenge}
                onFinalize={onFinalize}
                onAccept={onAccept}
                onReject={onReject}
                onCancel={onCancel}
                onNavigateAccount={(address) => onNavigate(`/account/${address}`)}
              />
            ))}
          </div>
        </section>
      ) : null}

      <section className="section">
        <div className="sectionHead">
          <h3 className="sectionTitle">Friends</h3>
          <span className="sectionNote">{isLoading && friends.length === 0 ? 'Loading…' : friends.length}</span>
        </div>

        {friends.length > 0 ? (
          <div className="listGroup">
            {friends.map((friend) => {
              const profile = friendProfileFor(snapshot?.friendProfiles, friend)
              const rep = snapshot?.friendRepScores?.[friend.toLowerCase()]
              // The address is only worth repeating when the row leads with a name.
              const secondary = secondaryNameFor(friend, profile)
              return (
                <ListRow
                  key={friend}
                  leading={<ProfileAvatar address={friend} profile={profile} size="sm" />}
                  title={displayNameFor(friend, profile)}
                  subtitle={secondary ? `${secondary} · Reputation ${rep ?? 0n}` : `Reputation ${rep ?? 0n}`}
                  href={`/account/${friend}`}
                  onClick={() => onNavigate(`/account/${friend}`)}
                  ariaLabel={`Open ${displayNameFor(friend, profile)}`}
                />
              )
            })}
          </div>
        ) : (
          <div className="emptyPanel">
            <h2>No finalized friendships yet</h2>
            <p>Stake with someone you know. Once you both make it through the challenge window, they show up here.</p>
            <button className="primaryButton full" type="button" onClick={onStartFriendship}>
              <UserPlus size={17} aria-hidden="true" /> Start friendship
            </button>
          </div>
        )}
      </section>
    </div>
  )
}
