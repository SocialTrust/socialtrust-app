import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import type { Address } from 'viem'
import type { ChallengeView, ContractConfig, SocialProfile, UserSnapshot } from '../types'
import { challengeSortScore, getChallengeState } from '../lib/challenges'
import { countdownUntil, formatUsdc, relativeTime, sameAddress, secondsToLabel, shortAddress } from '../lib/format'
import { ChallengeCard } from '../components/ChallengeCard'
import { ActivityFeed } from '../components/ActivityFeed'
import { ProfileAvatar, displayNameFor } from '../components/ProfileAvatar'


type MatchmakingHeroProps = {
  account?: Address
  config?: ContractConfig
  snapshot?: UserSnapshot
  nowSeconds: number
  txPending?: boolean
  onFindMatch: () => void
  onDepositAndMatchMe: (amount: string) => void
  onCancelMatch: () => void
  onStartWith: (address: Address) => void
  onOpenChallenge: (challenge: ChallengeView) => void
  onNavigateAccount: (address: Address) => void
  onSetTelegramUsername: (handle: string) => Promise<boolean | void>
}

// Mirror of the profiles hook's handle normalization, enough to gate the
// "Save handle" button and render the confirmation. The on-chain save still
// runs the authoritative normalization/validation inside setTelegramUsername.
function normalizeTelegramHandle(raw: string): string {
  let value = (raw ?? '').trim()
  value = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  value = value.replace(/^(?:t\.me|telegram\.me)\//i, '')
  value = value.replace(/^@+/, '')
  value = value.split(/[/?#]/)[0]
  return value.trim().toLowerCase()
}

function MatchmakingHero({
  account,
  config,
  snapshot,
  nowSeconds,
  txPending,
  onFindMatch,
  onDepositAndMatchMe,
  onCancelMatch,
  onStartWith,
  onOpenChallenge,
  onNavigateAccount,
  onSetTelegramUsername,
}: MatchmakingHeroProps) {
  const [gateOpen, setGateOpen] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [savedHandle, setSavedHandle] = useState<string | null>(null)
  const [savingHandle, setSavingHandle] = useState(false)

  const activeMatch = snapshot?.activeMatch
  const queueEntry = snapshot?.currentQueueEntry

  // Matched: an active, non-expired match. Expired matches are cleared
  // internally by matchMe / depositAndMatchMe, so we fall through to the
  // Available state and let "Find a match" clear them.
  if (activeMatch && account && !(activeMatch.deadline > 0n && BigInt(nowSeconds) > activeMatch.deadline)) {
    const partner = sameAddress(activeMatch.user0, account) ? activeMatch.user1 : activeMatch.user0
    const relationshipChallenge = snapshot?.challenges.find((challenge) => sameAddress(challenge.other, partner))

    return (
      <section className="homeIntroCta matchmakingHero" aria-label="Matchmaking">
        <span className="matchStatusLine matchStatusTrust">
          <span className="matchStatusDot" />
          <span className="matchStatusLabel">Matched</span>
        </span>
        <h1>You matched with {displayNameFor(partner, snapshot?.matchPartnerProfile)}</h1>
        <button className="matchPartnerLink" onClick={() => onNavigateAccount(partner)}>
          <ProfileAvatar address={partner} profile={snapshot?.matchPartnerProfile} size="sm" />
          <span className="matchPartnerAddress">{shortAddress(partner)}</span>
        </button>
        <p>Become friends before the deadline to get your match fee back.</p>
        {relationshipChallenge ? (
          <button className="trustButton" disabled={txPending} onClick={() => onOpenChallenge(relationshipChallenge)}>Open challenge</button>
        ) : (
          <button className="trustButton" disabled={txPending} onClick={() => onStartWith(partner)}>Start friendship</button>
        )}
        <span className="heroCaption">{countdownUntil(activeMatch.deadline, nowSeconds)} left</span>
      </section>
    )
  }

  if (queueEntry) {
    const cancelFee = queueEntry.cancelFeeAmount ?? config?.matchQueueCancelFee ?? 0n
    const refund = queueEntry.feeAmount > cancelFee ? queueEntry.feeAmount - cancelFee : 0n
    return (
      <section className="homeIntroCta matchmakingHero" aria-label="Matchmaking">
        <span className="matchStatusLine matchStatusWarning">
          <span className="matchStatusDot" />
          <span className="matchStatusLabel">Searching</span>
        </span>
        <h1>Looking for your match…</h1>
        <p>Queued {relativeTime(queueEntry.queuedAt, nowSeconds)}. Your {formatUsdc(queueEntry.feeAmount)} USDC fee is locked while you wait.</p>
        <button className="secondaryButton" disabled={txPending} onClick={onCancelMatch}>Cancel search</button>
        <span className="heroCaption">Cancelling refunds {formatUsdc(refund)} USDC</span>
      </section>
    )
  }

  const appBalance = snapshot?.appBalance ?? 0n
  const matchFee = config?.matchFee ?? 0n
  const hasEnoughBalance = appBalance >= matchFee
  const shortfall = matchFee > appBalance ? matchFee - appBalance : 0n
  const days = config?.matchTimeLimit ? `${Math.max(1, Math.round(Number(config.matchTimeLimit) / 86400))} days` : '—'

  // Matching reaches people over Telegram, so entering the queue is gated on a
  // handle being set. Once it is set on the profile — or freshly saved in this
  // session — "Find a match" behaves normally. Otherwise the first tap opens an
  // inline handle field (progressive disclosure, not an error) and the button
  // becomes "Save handle" until the handle is stored on chain.
  const hasTelegram = Boolean(snapshot?.socialProfile?.telegramUsername?.trim())
  const readyToMatch = hasTelegram || savedHandle !== null
  const normalizedHandle = normalizeTelegramHandle(handleInput)

  const startMatching = () => (hasEnoughBalance ? onFindMatch() : onDepositAndMatchMe(formatUsdc(shortfall)))

  const saveHandle = async () => {
    if (!normalizedHandle || savingHandle) return
    setSavingHandle(true)
    try {
      const ok = await onSetTelegramUsername(handleInput)
      if (ok) {
        setSavedHandle(normalizedHandle)
        setHandleInput('')
        setGateOpen(false)
      }
    } finally {
      setSavingHandle(false)
    }
  }

  const showGate = gateOpen && !readyToMatch

  let subtext: string
  if (showGate) subtext = 'Matches reach you on Telegram. Add your handle to join the queue.'
  else subtext = 'Get matched with a compatible account. Become friends before the deadline and your match fee comes back.'

  let caption: string | null
  if (savedHandle && readyToMatch) caption = `Saved @${savedHandle} — you're ready to match`
  else if (showGate) caption = null
  else if (hasEnoughBalance) caption = `${formatUsdc(matchFee)} USDC fee · ${days}`
  else caption = `Deposits ${formatUsdc(shortfall)} USDC from your wallet to cover the fee.`

  return (
    <section className="homeIntroCta matchmakingHero" aria-label="Matchmaking">
      <h1>Ready to build trust?</h1>
      <p>{subtext}</p>

      {showGate ? (
        <div className="matchHandleField">
          <span className="matchHandlePrefix">@</span>
          <input
            className="matchHandleInput"
            value={handleInput}
            onChange={(event) => setHandleInput(event.target.value)}
            placeholder="yourhandle"
            autoFocus
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            maxLength={32}
            aria-label="Telegram username"
          />
        </div>
      ) : null}

      {showGate ? (
        <button className="trustButton" disabled={savingHandle || !normalizedHandle} onClick={saveHandle}>
          Save handle
        </button>
      ) : (
        <button
          className="trustButton"
          disabled={txPending || matchFee === 0n}
          onClick={() => (readyToMatch ? startMatching() : setGateOpen(true))}
        >
          Find a match
        </button>
      )}

      {caption ? <span className="heroCaption">{caption}</span> : null}
    </section>
  )
}


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
  onStartWith: (address: Address) => void
  onFindMatch: () => void
  onDepositAndMatchMe: (amount: string) => void
  onCancelMatch: () => void
  onSetTelegramUsername: (handle: string) => Promise<boolean | void>
  txPending?: boolean
  onOpenChallenge: (challenge: ChallengeView) => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onNavigate: (path: string) => void
  nowSeconds: number
}

export function HomePage({ account, isConnected, config, snapshot, isLoading, onConnect, onStartWith, onFindMatch, onDepositAndMatchMe, onCancelMatch, onSetTelegramUsername, txPending, onOpenChallenge, onFinalize, onAccept, onReject, onCancel, onNavigate, nowSeconds }: HomePageProps) {
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
      <MatchmakingHero
        account={account}
        config={config}
        snapshot={snapshot}
        nowSeconds={nowSeconds}
        txPending={txPending}
        onFindMatch={onFindMatch}
        onDepositAndMatchMe={onDepositAndMatchMe}
        onCancelMatch={onCancelMatch}
        onStartWith={onStartWith}
        onOpenChallenge={onOpenChallenge}
        onNavigateAccount={(address) => onNavigate(`/account/${address}`)}
        onSetTelegramUsername={onSetTelegramUsername}
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
