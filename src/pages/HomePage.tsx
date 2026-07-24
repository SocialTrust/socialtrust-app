import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Address } from 'viem'
import type { ChallengeView, ContractConfig, SocialProfile, UserSnapshot } from '../types'
import { challengeSortScore, getChallengeState } from '../lib/challenges'
import { formatUsdc, secondsToLabel } from '../lib/format'
import { ChallengeCard } from '../components/ChallengeCard'
import { ActivityFeed } from '../components/ActivityFeed'
import { ProfileAvatar, displayNameFor } from '../components/ProfileAvatar'
import { MatchmakingCard } from '../components/MatchmakingCard'


function FriendsSection({
  friends,
  friendProfiles,
  friendRepScores,
  onNavigate,
}: {
  friends: Address[]
  friendProfiles?: Record<string, SocialProfile>
  friendRepScores?: Record<string, bigint>
  onNavigate: (path: string) => void
}) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? friends : friends.slice(0, 4)

  return (
    <section className="homeSection feedSection friendsHomeSection">
      <div className="sectionHeader slimHeader">
        <h2>Friends</h2>
      </div>
      {friends.length > 0 ? (
        <>
          <div className="friendCardList homeFriendList">
            {visible.map((friend) => {
              const friendProfile = friendProfiles?.[friend.toLowerCase()]
              const friendRep = friendRepScores?.[friend.toLowerCase()] ?? 0n
              return (
                <button
                  className="friendRowCard friendRowTwoLine"
                  key={friend}
                  onClick={() => onNavigate(`/account/${friend}`)}
                  aria-label={`Open ${displayNameFor(friend, friendProfile)}`}
                >
                  <ProfileAvatar address={friend} profile={friendProfile} size="sm" />
                  <span>
                    <strong>{displayNameFor(friend, friendProfile)}</strong>
                    <small>Reputation {String(friendRep)}</small>
                  </span>
                </button>
              )
            })}
          </div>
          {friends.length > 4 ? (
            <button className="feedToggle" onClick={() => setExpanded((open) => !open)}>
              {expanded ? <>Show less <ChevronUp size={15} /></> : <>Show {friends.length - 4} more <ChevronDown size={15} /></>}
            </button>
          ) : null}
        </>
      ) : (
        <p className="quietHelperText">No finalized friendships yet.</p>
      )}
    </section>
  )
}

type HomePageProps = {
  account?: Address
  isConnected: boolean
  config?: ContractConfig
  snapshot?: UserSnapshot
  isLoading: boolean
  onConnect: () => void
  onStart: () => void
  onStartWith: (address: Address) => void
  onFindMatch: () => void
  onCancelMatch: () => void
  onCleanupExpiredMatch: () => void
  onOpenWallet: () => void
  txPending?: boolean
  onOpenChallenge: (challenge: ChallengeView) => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onNavigate: (path: string) => void
  nowSeconds: number
}

export function HomePage({ account, isConnected, config, snapshot, isLoading, onConnect, onStart, onStartWith, onFindMatch, onCancelMatch, onCleanupExpiredMatch, onOpenWallet, txPending, onOpenChallenge, onFinalize, onAccept, onReject, onCancel, onNavigate, nowSeconds }: HomePageProps) {
  const challenges = [...(snapshot?.challenges ?? [])].sort((a, b) => challengeSortScore(a, nowSeconds) - challengeSortScore(b, nowSeconds))
  const feedItems = challenges.filter((challenge) => getChallengeState(challenge, nowSeconds) !== 'unknown')

  if (!isConnected) {
    return (
      <div className="landingStack">
        <section className="landingHero panelCard">
          <span className="eyebrow">SocialTrust</span>
          <h1>Build trust with real stakes.</h1>
          <p>Stake USDC with someone. If neither of you steals before the timer ends, you become friends and get your stake back.</p>
          <button className="primaryButton" onClick={onConnect}>Connect wallet</button>
        </section>

        <section className="panelCard termsPanel">
          <span className="eyebrow">Current parameters</span>
          <div className="termsBox">
            <div><span>Stake</span><strong>{formatUsdc(config?.stakeAmt)} USDC</strong></div>
            <div><span>Duration</span><strong>{secondsToLabel(config?.challengeDuration)}</strong></div>
            <div><span>Steal opens</span><strong>after {secondsToLabel(config?.stealGracePeriod)}</strong></div>
            <div><span>Steal bounty</span><strong>{formatUsdc(config?.stealBounty)} USDC</strong></div>
          </div>
        </section>

        <section className="panelCard howItWorks">
          <span className="eyebrow">How it works</span>
          <div className="simpleSteps">
            <div><strong>Start</strong><span>Stake with another account.</span></div>
            <div><strong>Wait</strong><span>Once both stake, the timer starts.</span></div>
            <div><strong>Finalize</strong><span>If nobody steals, friendship is recorded.</span></div>
          </div>
        </section>
      </div>
    )
  }

  return (
    <div className="homeLayout">
      <section className="homeIntroCta" aria-label="Start a friendship">
        <h1>Ready to build trust?</h1>
        <p>Stake {formatUsdc(config?.stakeAmt)} USDC with another account. If nobody steals before {secondsToLabel(config?.challengeDuration)}, the friendship is recorded.</p>
        <button className="trustButton" onClick={onStart}>Start friendship</button>
      </section>

      <MatchmakingCard
        account={account}
        config={config}
        snapshot={snapshot}
        nowSeconds={nowSeconds}
        txPending={txPending}
        onFindMatch={onFindMatch}
        onCancelMatch={onCancelMatch}
        onCleanupExpiredMatch={onCleanupExpiredMatch}
        onStartWith={onStartWith}
        onOpenChallenge={onOpenChallenge}
        onOpenWallet={onOpenWallet}
        onNavigateAccount={(address) => onNavigate(`/account/${address}`)}
      />

      <section className="homeSection feedSection">
        <div className="sectionHeader slimHeader">
          <h2>Needs attention</h2>
          {isLoading ? <small>Refreshing…</small> : null}
        </div>

        {feedItems.length > 0 ? (
          <div className="challengeStack">
            {feedItems.map((challenge) => (
              <ChallengeCard
                key={challenge.pairKey}
                challenge={challenge}
                config={config}
                onOpen={onOpenChallenge}
                onFinalize={onFinalize}
                onAccept={onAccept}
                onReject={onReject}
                onCancel={onCancel}
                onNavigateAccount={(address) => onNavigate(`/account/${address}`)}
                nowSeconds={nowSeconds}
              />
            ))}
          </div>
        ) : (
          <p className="quietHelperText">No pending invites, open steal windows, or finalizations.</p>
        )}
      </section>

      <section className="homeSection feedSection">
        <div className="sectionHeader slimHeader">
          <h2>Recent activity</h2>
        </div>
        <ActivityFeed items={snapshot?.recentActivity ?? []} onNavigateAccount={(address) => onNavigate(`/account/${address}`)} nowSeconds={nowSeconds} />
      </section>

      <FriendsSection
        friends={snapshot?.friends ?? []}
        friendProfiles={snapshot?.friendProfiles}
        friendRepScores={snapshot?.friendRepScores}
        onNavigate={onNavigate}
      />
    </div>
  )
}
