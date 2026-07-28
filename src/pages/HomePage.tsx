import { useState } from 'react'
import type { Address } from 'viem'
import type { ChallengeView, ContractConfig, SocialProfile, UserSnapshot } from '../types'
import type { ProfileFormValues } from '../components/ProfileEditSheet'
import { challengeSortScore, isAttentionState, getChallengeState } from '../lib/challenges'
import { countdownUntil, durationLabelOrDash, formatUsdc, formatUsdcOrDash, relativeTime, sameAddress, secondsToLabelOrDash, shortAddress } from '../lib/format'
import { ChallengeRow } from '../components/ChallengeRow'
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
  readSocialProfile: (account: Address) => Promise<SocialProfile>
  onStartWith: (address: Address) => void
  onOpenChallenge: (challenge: ChallengeView) => void
  onNavigateAccount: (address: Address) => void
  onSetProfile: (values: ProfileFormValues) => Promise<boolean | void>
}

// Mirror of the profiles hook's handle normalization, enough to gate the
// "Save handle" button and render the confirmation. The on-chain save still
// runs the authoritative normalization/validation inside the whole-profile save.
function normalizeTelegramHandle(raw: string): string {
  let value = (raw ?? '').trim()
  value = value.replace(/^https?:\/\//i, '').replace(/^www\./i, '')
  value = value.replace(/^(?:t\.me|telegram\.me)\//i, '')
  value = value.replace(/^@+/, '')
  value = value.split(/[/?#]/)[0]
  return value.trim().toLowerCase()
}

export async function saveMatchmakingTelegramUsername(
  account: Address,
  telegramUsername: string,
  readSocialProfile: (account: Address) => Promise<SocialProfile>,
  setProfile: (values: ProfileFormValues) => Promise<boolean | void>,
) {
  const current = await readSocialProfile(account)
  return setProfile({
    displayName: current.displayName,
    xUsername: current.xUsername,
    telegramUsername,
    discordUsername: current.discordUsername,
    imgUrl: current.imgUrl,
  })
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
  readSocialProfile,
  onStartWith,
  onOpenChallenge,
  onNavigateAccount,
  onSetProfile,
}: MatchmakingHeroProps) {
  const [gateOpen, setGateOpen] = useState(false)
  const [handleInput, setHandleInput] = useState('')
  const [savedHandle, setSavedHandle] = useState<string | null>(null)
  const [savingHandle, setSavingHandle] = useState(false)
  const [checkingHandle, setCheckingHandle] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)

  const activeMatch = snapshot?.activeMatch
  const queueEntry = snapshot?.currentQueueEntry

  // Matched: an active, non-expired match. Expired matches are cleared
  // internally by matchMe / depositAndMatchMe, so we fall through to the
  // Available state and let "Find a match" clear them.
  if (activeMatch && account && !(activeMatch.deadline > 0n && BigInt(nowSeconds) > activeMatch.deadline)) {
    const partner = sameAddress(activeMatch.user0, account) ? activeMatch.user1 : activeMatch.user0
    const relationshipChallenge = snapshot?.challenges.find((challenge) => sameAddress(challenge.other, partner))

    return (
      <section className="hero" aria-label="Matchmaking">
        <span className="statusLine statusLineTrust">
          <span className="statusDot" aria-hidden="true" />
          Matched
        </span>
        <h2>You matched with {displayNameFor(partner, snapshot?.matchPartnerProfile)}</h2>
        <button className="heroPartner" type="button" onClick={() => onNavigateAccount(partner)}>
          <ProfileAvatar address={partner} profile={snapshot?.matchPartnerProfile} size="sm" />
          <span>{shortAddress(partner, 6)}</span>
        </button>
        <p>Become friends before the deadline to get your match fee back.</p>
        {relationshipChallenge ? (
          <button className="primaryButton full" type="button" disabled={txPending} onClick={() => onOpenChallenge(relationshipChallenge)}>Open challenge</button>
        ) : (
          <button className="primaryButton full" type="button" disabled={txPending} onClick={() => onStartWith(partner)}>Start friendship</button>
        )}
        <span className="heroCaption">{countdownUntil(activeMatch.deadline, nowSeconds)} left</span>
      </section>
    )
  }

  if (queueEntry) {
    const cancelFee = queueEntry.cancelFeeAmount ?? config?.matchQueueCancelFee ?? 0n
    const refund = queueEntry.feeAmount > cancelFee ? queueEntry.feeAmount - cancelFee : 0n
    return (
      <section className="hero" aria-label="Matchmaking">
        <span className="statusLine statusLineSearching">
          <span className="statusDot" aria-hidden="true" />
          Searching
        </span>
        <h2>Looking for your match…</h2>
        <p>Queued {relativeTime(queueEntry.queuedAt, nowSeconds)}. Your {formatUsdc(queueEntry.feeAmount)} USDC fee is locked while you wait.</p>
        <button className="secondaryButton full" type="button" disabled={txPending} onClick={onCancelMatch}>Cancel search</button>
        <span className="heroCaption">Cancelling refunds {formatUsdc(refund)} USDC</span>
      </section>
    )
  }

  const appBalance = snapshot?.appBalance ?? 0n
  const matchFee = config?.matchFee ?? 0n
  const hasEnoughBalance = appBalance >= matchFee
  const shortfall = matchFee > appBalance ? matchFee - appBalance : 0n
  // Natural wording straight from the on-chain window: a ten-minute window
  // must not round up to a day.
  const matchWindow = durationLabelOrDash(config?.matchTimeLimit)

  // Matching reaches people over Telegram, so entering the queue is gated on a
  // handle being stored on chain. The profiles contract is the only authority
  // here: it already rejects a malformed non-empty handle at write time, so a
  // fresh strict read that comes back non-empty is enough to match. Local state
  // — including a handle saved earlier in this session — never authorizes
  // matchmaking, because the profile can be cleared from the editor afterwards.
  // When the fresh read comes back empty the first tap opens an inline handle
  // field (progressive disclosure, not an error) and the button becomes
  // "Save handle" until the handle is stored on chain.
  const normalizedHandle = normalizeTelegramHandle(handleInput)

  const startMatching = () => (hasEnoughBalance ? onFindMatch() : onDepositAndMatchMe(formatUsdc(shortfall)))

  const tryStartMatching = async () => {
    if (!account || checkingHandle) return
    setCheckingHandle(true)
    setProfileError(null)
    try {
      const profile = await readSocialProfile(account)
      if (!profile.telegramUsername.trim()) {
        setGateOpen(true)
        return
      }
      startMatching()
    } catch {
      // Fail closed: an unverifiable profile never reaches a wallet prompt.
      setProfileError('Could not load your profile. Try again.')
    } finally {
      setCheckingHandle(false)
    }
  }

  const saveHandle = async () => {
    if (!normalizedHandle || savingHandle) return
    setSavingHandle(true)
    setProfileError(null)
    try {
      if (!account) return
      const ok = await saveMatchmakingTelegramUsername(account, handleInput, readSocialProfile, onSetProfile)
      if (ok) {
        setSavedHandle(normalizedHandle)
        setHandleInput('')
        setGateOpen(false)
      }
    } catch {
      setProfileError('Could not load your profile. Try again.')
    } finally {
      setSavingHandle(false)
    }
  }

  let subtext: string
  if (gateOpen) subtext = 'Matches reach you on Telegram. Add your handle to join the queue.'
  else subtext = 'Get matched with a compatible account. Become friends before the deadline and your match fee comes back.'

  let caption: string | null
  if (profileError) caption = profileError
  else if (savedHandle && !gateOpen) caption = `Saved @${savedHandle} — you're ready to match`
  else if (gateOpen) caption = null
  // Config still loading: hold the line's space with placeholders instead of
  // printing a fee and window of zero.
  else if (!config) caption = `${formatUsdcOrDash(undefined)} USDC fee · ${matchWindow}`
  else if (hasEnoughBalance) caption = `${formatUsdc(matchFee)} USDC fee · ${matchWindow}`
  else caption = `Deposits ${formatUsdc(shortfall)} USDC from your wallet to cover the fee.`

  return (
    <section className="hero" aria-label="Matchmaking">
      <h2>Ready to build trust?</h2>
      <p>{subtext}</p>

      {gateOpen ? (
        <div className="handleField">
          <span className="handlePrefix" aria-hidden="true">@</span>
          <input
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

      {gateOpen ? (
        <button className="primaryButton full" type="button" disabled={savingHandle || !normalizedHandle} onClick={saveHandle}>
          Save handle
        </button>
      ) : (
        <button
          className="primaryButton full"
          type="button"
          disabled={txPending || checkingHandle || matchFee === 0n}
          onClick={() => void tryStartMatching()}
        >
          Find a match
        </button>
      )}

      {caption ? <span className={`heroCaption ${profileError ? 'heroCaptionError' : ''}`}>{caption}</span> : null}

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
  readSocialProfile: (account: Address) => Promise<SocialProfile>
  onSetProfile: (values: ProfileFormValues) => Promise<boolean | void>
  txPending?: boolean
  onOpenChallenge: (challenge: ChallengeView) => void
  onFinalize: (challenge: ChallengeView) => void
  onAccept: (challenge: ChallengeView) => void
  onReject: (challenge: ChallengeView) => void
  onCancel: (challenge: ChallengeView) => void
  onNavigate: (path: string) => void
  nowSeconds: number
}

export function HomePage({
  account,
  isConnected,
  config,
  snapshot,
  isLoading,
  onConnect,
  onStartWith,
  onFindMatch,
  onDepositAndMatchMe,
  onCancelMatch,
  readSocialProfile,
  onSetProfile,
  txPending,
  onOpenChallenge,
  onFinalize,
  onAccept,
  onReject,
  onCancel,
  onNavigate,
  nowSeconds,
}: HomePageProps) {
  const challenges = [...(snapshot?.challenges ?? [])].sort((a, b) => challengeSortScore(a, nowSeconds) - challengeSortScore(b, nowSeconds))
  // Only states that actually need the user: an active-safe challenge is
  // progressing normally and lives under Friends -> In progress.
  const attention = challenges.filter((challenge) => isAttentionState(getChallengeState(challenge, nowSeconds)))

  if (!isConnected) {
    return (
      <div className="pageStack">
        <section className="hero landingHero">
          <span className="eyebrow">SocialTrust</span>
          <h2>Build trust with real stakes.</h2>
          <p>Stake USDC with someone. If neither of you steals before the timer ends, you become friends and get your stake back.</p>
          <button className="primaryButton full" type="button" onClick={onConnect}>Connect wallet</button>
        </section>

        <section className="section">
          <h3 className="sectionTitle">Current parameters</h3>
          <dl className="factList">
            <div><dt>Stake</dt><dd>{config ? `${formatUsdc(config.stakeAmt)} USDC` : formatUsdcOrDash(undefined)}</dd></div>
            <div><dt>Duration</dt><dd>{secondsToLabelOrDash(config?.challengeDuration)}</dd></div>
            <div><dt>Steal opens</dt><dd>{config ? `after ${secondsToLabelOrDash(config.stealGracePeriod)}` : secondsToLabelOrDash(undefined)}</dd></div>
            <div><dt>Steal bounty</dt><dd>{config ? `${formatUsdc(config.stealBounty)} USDC` : formatUsdcOrDash(undefined)}</dd></div>
          </dl>
        </section>

        <section className="section">
          <h3 className="sectionTitle">How it works</h3>
          <ol className="steps">
            <li><strong>Start</strong><span>Stake with another account.</span></li>
            <li><strong>Wait</strong><span>Once both stake, the timer starts.</span></li>
            <li><strong>Finalize</strong><span>If nobody steals, the friendship is recorded.</span></li>
          </ol>
        </section>
      </div>
    )
  }

  return (
    <div className="pageStack">
      <MatchmakingHero
        account={account}
        config={config}
        snapshot={snapshot}
        nowSeconds={nowSeconds}
        txPending={txPending}
        onFindMatch={onFindMatch}
        onDepositAndMatchMe={onDepositAndMatchMe}
        onCancelMatch={onCancelMatch}
        readSocialProfile={readSocialProfile}
        onStartWith={onStartWith}
        onOpenChallenge={onOpenChallenge}
        onNavigateAccount={(address) => onNavigate(`/account/${address}`)}
        onSetProfile={onSetProfile}
      />

      <section className="section">
        <div className="sectionHead">
          <h3 className="sectionTitle">Needs attention</h3>
          {isLoading ? <span className="sectionNote">Refreshing…</span> : null}
        </div>

        {attention.length > 0 ? (
          <div className="rowStack">
            {attention.map((challenge) => (
              <ChallengeRow
                key={challenge.pairKey}
                challenge={challenge}
                profile={snapshot?.friendProfiles?.[challenge.other.toLowerCase()]}
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
        ) : (
          <p className="emptyNote">Nothing needs you right now. Pending invites, open steal windows, and finalizations show up here.</p>
        )}
      </section>
    </div>
  )
}
