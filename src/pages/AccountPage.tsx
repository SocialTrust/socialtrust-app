import { useEffect, useRef, useState } from 'react'
import type { Address } from 'viem'
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  Check,
  Copy,
  FileText,
  LogOut,
  Pencil,
  QrCode,
  Settings,
  Wallet,
} from 'lucide-react'
import type { ContractConfig, UserSnapshot } from '../types'
import { copyText, formatUsdc, shortAddress } from '../lib/format'
import { appConfig } from '../lib/config'
import { ListRow } from '../components/ListRow'
import { ProfileAvatar } from '../components/ProfileAvatar'

type AccountPageProps = {
  account?: Address
  isConnected: boolean
  isOwner: boolean
  snapshot?: UserSnapshot
  config?: ContractConfig
  wrongNetwork?: boolean
  onConnect: () => void
  onEditProfile: () => void
  onShowQr: () => void
  onOpenWallet: (tab: 'deposit' | 'withdraw') => void
  onOpenAdmin: () => void
  onOpenTerms: () => void
  onSwitchNetwork: () => void
  onDisconnect: () => void
}

function handleValue(value?: string) {
  const clean = value?.trim()
  return clean ? `@${clean}` : 'Not set'
}

export function AccountPage({
  account,
  isConnected,
  isOwner,
  snapshot,
  config,
  wrongNetwork,
  onConnect,
  onEditProfile,
  onShowQr,
  onOpenWallet,
  onOpenAdmin,
  onOpenTerms,
  onSwitchNetwork,
  onDisconnect,
}: AccountPageProps) {
  const [copied, setCopied] = useState(false)
  const copiedTimerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
  }, [])

  if (!isConnected || !account) {
    return (
      <div className="pageStack">
        <section className="emptyPanel">
          <h2>Connect your wallet</h2>
          <p>Your account, balances, profile, and controls live here once a wallet is connected.</p>
          <button className="primaryButton full" type="button" onClick={onConnect}>Connect wallet</button>
        </section>
      </div>
    )
  }

  const profile = snapshot?.socialProfile
  const displayName = profile?.displayName?.trim() || 'My account'
  const allowance = snapshot?.allowance ?? 0n
  const stake = config?.stakeAmt ?? 0n
  // An allowance only matters when the next deposit or stake would need an
  // extra approval transaction. Otherwise it is noise.
  const showAllowance = stake > 0n && allowance < stake

  const copyAddress = async () => {
    await copyText(account)
    setCopied(true)
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1600)
  }

  return (
    <div className="pageStack">
      <section className="identityBlock">
        <ProfileAvatar address={account} profile={profile} size="lg" />
        <h2>{displayName}</h2>
        <button
          className={`addressChip ${copied ? 'copied' : ''}`}
          type="button"
          onClick={copyAddress}
          aria-label={copied ? 'Address copied' : 'Copy your wallet address'}
        >
          {shortAddress(account, 6)}
          {copied ? <Check size={14} aria-hidden="true" /> : <Copy size={14} aria-hidden="true" />}
        </button>
        <span className="copyFeedback" role="status">{copied ? 'Address copied' : ''}</span>
        <div className="identityActions">
          <button className="secondaryButton" type="button" onClick={onEditProfile}>
            <Pencil size={15} aria-hidden="true" /> Edit profile
          </button>
          <button className="secondaryButton" type="button" onClick={onShowQr}>
            <QrCode size={15} aria-hidden="true" /> Show my QR
          </button>
        </div>
      </section>

      <section className="statPair" aria-label="Key stats">
        <div>
          <span>Reputation</span>
          <strong>{String(snapshot?.repScore ?? 0n)}</strong>
        </div>
        <div>
          <span>Friends</span>
          <strong>{String(snapshot?.friendCount ?? 0n)}</strong>
        </div>
      </section>

      <section className="section">
        <h3 className="sectionTitle">Funds</h3>
        <div className="listGroup">
          <ListRow
            leading={<span className="rowIcon"><Wallet size={16} aria-hidden="true" /></span>}
            title="SocialTrust app balance"
            subtitle="Held for stakes and match fees"
            value={`${formatUsdc(snapshot?.appBalance)} USDC`}
            trailing={null}
          />
          <ListRow
            title="Wallet USDC"
            subtitle="In your wallet, not yet deposited"
            value={`${formatUsdc(snapshot?.walletUsdc)} USDC`}
            trailing={null}
          />
          {showAllowance ? (
            <ListRow
              title="USDC allowance"
              subtitle="Below the stake — expect an approval step"
              value={`${formatUsdc(allowance)} USDC`}
              trailing={null}
            />
          ) : null}
          <ListRow
            title="Network"
            value={appConfig.chainName}
            subtitle={wrongNetwork ? 'Your wallet is on a different network' : undefined}
            trailing={wrongNetwork ? <span className="rowBadge rowBadgeWarning">Switch</span> : null}
            onClick={wrongNetwork ? onSwitchNetwork : undefined}
          />
        </div>
        <div className="buttonPair">
          <button className="primaryButton" type="button" onClick={() => onOpenWallet('deposit')}>
            <ArrowDownToLine size={16} aria-hidden="true" /> Deposit
          </button>
          <button className="secondaryButton" type="button" onClick={() => onOpenWallet('withdraw')}>
            <ArrowUpFromLine size={16} aria-hidden="true" /> Withdraw
          </button>
        </div>
      </section>

      <section className="section">
        <div className="sectionHead">
          <h3 className="sectionTitle">Public profile</h3>
          <button className="linkButton" type="button" onClick={onEditProfile}>Edit profile</button>
        </div>
        <div className="listGroup">
          <ListRow title="Display name" value={profile?.displayName?.trim() || 'Not set'} trailing={null} />
          <ListRow title="X" value={handleValue(profile?.xUsername)} trailing={null} />
          <ListRow title="Telegram" value={handleValue(profile?.telegramUsername)} trailing={null} />
          <ListRow title="Discord" value={handleValue(profile?.discordUsername)} trailing={null} />
          <ListRow
            title="Profile image"
            value={profile?.imgUrl?.trim() ? 'Set' : 'Default avatar'}
            trailing={<ProfileAvatar address={account} profile={profile} size="sm" />}
          />
        </div>
        <p className="quietCaption">These handles are self-declared and stored on chain. SocialTrust does not verify that you own them.</p>
      </section>

      <section className="section">
        <h3 className="sectionTitle">Account</h3>
        <div className="listGroup">
          {/* Network lives in Funds, where it can also show the wrong-network
              state and offer the switch. One row is enough. */}
          <ListRow title="Connected wallet" value={shortAddress(account, 6)} trailing={null} />
          <ListRow
            leading={<span className="rowIcon"><FileText size={16} aria-hidden="true" /></span>}
            title="Protocol terms"
            subtitle="Live stake, fee, and timing settings"
            onClick={onOpenTerms}
          />
          {isOwner ? (
            <ListRow
              leading={<span className="rowIcon"><Settings size={16} aria-hidden="true" /></span>}
              title="Admin controls"
              subtitle="Challenge, bonus, and reputation settings"
              value={<span className="rowBadge">Owner</span>}
              onClick={onOpenAdmin}
            />
          ) : null}
        </div>
      </section>

      <section className="section">
        <div className="listGroup listGroupQuiet">
          <ListRow
            leading={<span className="rowIcon rowIconDanger"><LogOut size={16} aria-hidden="true" /></span>}
            title="Disconnect wallet"
            tone="danger"
            onClick={onDisconnect}
            trailing={null}
          />
        </div>
      </section>
    </div>
  )
}
