import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import { Check, Copy } from 'lucide-react'
import type { AccountProfile, ChallengeView, SocialProfile } from '../types'
import { copyText, sameAddress, shortAddress } from '../lib/format'
import { getChallengeState, stateLabel } from '../lib/challenges'
import { ListRow } from '../components/ListRow'
import { ProfileAvatar, displayNameFor, secondaryNameFor } from '../components/ProfileAvatar'

type PublicProfilePageProps = {
  address?: Address
  connectedAccount?: Address
  isConnected: boolean
  readAccountProfile: (address: Address) => Promise<AccountProfile>
  onConnect: () => void
  onStartWith: (address: Address) => void
  onOpenChallenge: (challenge: ChallengeView) => void
  onNavigate: (path: string) => void
  nowSeconds: number
}

function handleRow(label: string, value?: string) {
  const clean = value?.trim()
  if (!clean) return null
  return <ListRow key={label} title={label} value={`@${clean}`} trailing={null} />
}

/**
 * A public, social view of another account. It deliberately renders no
 * self-only data: app balance, wallet USDC, allowance, profile editing, and
 * admin controls exist only on the Account tab.
 */
export function PublicProfilePage({
  address,
  connectedAccount,
  isConnected,
  readAccountProfile,
  onConnect,
  onStartWith,
  onOpenChallenge,
  onNavigate,
  nowSeconds,
}: PublicProfilePageProps) {
  const [profile, setProfile] = useState<AccountProfile | undefined>()
  const [error, setError] = useState<string | undefined>()
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
  }, [])

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!address) return
      setLoading(true)
      setError(undefined)
      setProfile(undefined)
      try {
        const next = await readAccountProfile(address)
        if (!cancelled) setProfile(next)
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load account.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [address, readAccountProfile])

  if (!address) {
    return (
      <div className="pageStack">
        <section className="emptyPanel">
          <h2>Account not found</h2>
          <p>Public profiles use the /account/0x… route.</p>
          <button className="secondaryButton full" type="button" onClick={() => onNavigate('/friends')}>Back to friends</button>
        </section>
      </div>
    )
  }

  const isSelf = Boolean(connectedAccount && sameAddress(address, connectedAccount))
  const socialProfile: SocialProfile | undefined = profile?.socialProfile
  const relationship = profile?.relationshipChallenge
  const relationshipState = relationship ? getChallengeState(relationship, nowSeconds) : undefined

  const copyAddress = async () => {
    await copyText(address)
    setCopied(true)
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="pageStack">
      <section className="identityBlock">
        <ProfileAvatar address={address} profile={socialProfile} size="lg" />
        <h2>{displayNameFor(address, socialProfile)}</h2>
        <button
          className={`addressChip ${copied ? 'copied' : ''}`}
          type="button"
          onClick={copyAddress}
          aria-label={copied ? 'Address copied' : 'Copy wallet address'}
        >
          {shortAddress(address, 6)}
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
        <span className="copyFeedback" role="status">{copied ? 'Address copied' : ''}</span>
      </section>

      {loading ? <p className="emptyNote" role="status">Loading account…</p> : null}
      {error ? (
        <section className="emptyPanel emptyPanelError">
          <h2>Could not load account</h2>
          <p>{error}</p>
        </section>
      ) : null}

      {profile ? (
        <>
          <section className="statPair" aria-label="Public stats">
            <div>
              <span>Reputation</span>
              <strong>{String(profile.repScore)}</strong>
            </div>
            <div>
              <span>Friends</span>
              <strong>{String(profile.friendCount)}</strong>
            </div>
          </section>

          {isSelf ? (
            <section className="section">
              <div className="listGroup">
                <ListRow
                  title="This is your account"
                  subtitle="Balances, profile editing, and controls live on the Account tab"
                  onClick={() => onNavigate('/me')}
                />
              </div>
            </section>
          ) : !isConnected ? (
            <section className="emptyPanel">
              <p>Connect to start a friendship with this account or respond to an invite.</p>
              <button className="primaryButton full" type="button" onClick={onConnect}>Connect wallet</button>
            </section>
          ) : profile.isFriendWithViewer ? (
            <section className="section">
              <p className="statusBanner statusBannerTrust">You and this account are friends.</p>
            </section>
          ) : relationship && relationshipState ? (
            <section className="section">
              <button className="primaryButton full" type="button" onClick={() => onOpenChallenge(relationship)}>
                Open challenge · {stateLabel(relationshipState)}
              </button>
            </section>
          ) : (
            <section className="section">
              <button className="primaryButton full" type="button" onClick={() => onStartWith(address)}>Start friendship</button>
            </section>
          )}

          {socialProfile?.xUsername?.trim() || socialProfile?.telegramUsername?.trim() || socialProfile?.discordUsername?.trim() ? (
            <section className="section">
              <h3 className="sectionTitle">Handles</h3>
              <div className="listGroup">
                {handleRow('X', socialProfile?.xUsername)}
                {handleRow('Telegram', socialProfile?.telegramUsername)}
                {handleRow('Discord', socialProfile?.discordUsername)}
              </div>
              <p className="quietCaption">Self-declared handles stored on chain. SocialTrust does not verify ownership.</p>
            </section>
          ) : null}

          <section className="section">
            <div className="sectionHead">
              <h3 className="sectionTitle">Friends</h3>
              <span className="sectionNote">{String(profile.friendCount)}</span>
            </div>
            {profile.friends.length > 0 ? (
              <div className="listGroup">
                {profile.friends.slice(0, 12).map((friend) => {
                  const friendProfile = profile.friendProfiles?.[friend.toLowerCase()]
                  const rep = profile.friendRepScores?.[friend.toLowerCase()]
                  const secondary = secondaryNameFor(friend, friendProfile)
                  return (
                    <ListRow
                      key={friend}
                      leading={<ProfileAvatar address={friend} profile={friendProfile} size="sm" />}
                      title={displayNameFor(friend, friendProfile)}
                      subtitle={secondary ? `${secondary} · Reputation ${rep ?? 0n}` : `Reputation ${rep ?? 0n}`}
                      href={`/account/${friend}`}
                      onClick={() => onNavigate(`/account/${friend}`)}
                      ariaLabel={`Open ${displayNameFor(friend, friendProfile)}`}
                    />
                  )
                })}
              </div>
            ) : (
              <p className="emptyNote">No finalized friendships yet.</p>
            )}
          </section>
        </>
      ) : null}
    </div>
  )
}
