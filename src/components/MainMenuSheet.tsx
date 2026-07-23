import { useState } from 'react'
import { ChevronDown, ChevronRight, ChevronUp, FileText, LogOut, Settings, Wallet } from 'lucide-react'
import type { Address } from 'viem'
import type { ContractConfig } from '../types'
import { formatUsdc, secondsToLabel, shortAddress } from '../lib/format'
import { Sheet } from './Sheet'

type MainMenuSheetProps = {
  open: boolean
  account?: Address
  isConnected: boolean
  isOwner: boolean
  config?: ContractConfig
  onClose: () => void
  onConnect: () => void
  onDisconnect: () => void
  onStart: () => void
  onOpenWallet: () => void
  onOpenAdmin: () => void
}

export function MainMenuSheet({ open, account, isConnected, isOwner, config, onClose, onConnect, onDisconnect, onStart, onOpenWallet, onOpenAdmin }: MainMenuSheetProps) {
  const [termsOpen, setTermsOpen] = useState(false)

  if (!isConnected || !account) {
    return (
      <Sheet open={open} title="Menu" onClose={onClose}>
        <div className="menuStack">
          <section className="menuSection aboutBox">
            <span className="eyebrow">About</span>
            <h3>SocialTrust is a trust graph with real stakes.</h3>
            <p>Two accounts stake USDC. If both make it through the challenge window without stealing, the friendship is finalized and stakes are returned.</p>
          </section>
          <button className="primaryButton full" onClick={onConnect}>Connect wallet</button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} title="Menu" onClose={onClose}>
      <div className="menuStack">
        <div className="menuHero">
          <button className="trustButton" onClick={() => { onClose(); onStart() }}>Start friendship</button>
          <p className="menuHeroCaption">Stake {formatUsdc(config?.stakeAmt)} USDC · {secondsToLabel(config?.challengeDuration)} challenge</p>
        </div>

        <div className="menuRowList">
          <button className="menuRow" onClick={() => { onClose(); onOpenWallet() }}>
            <Wallet size={17} />
            <span className="menuRowLabel">Deposit / withdraw</span>
            <ChevronRight size={16} />
          </button>

          <button className="menuRow" aria-expanded={termsOpen} onClick={() => setTermsOpen((expanded) => !expanded)}>
            <FileText size={17} />
            <span className="menuRowLabel">Protocol terms</span>
            {termsOpen ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>

          {termsOpen ? (
            <div className="menuTermsPanel">
              <div className="menuTermsList">
                <div><span>Stake</span><strong>{formatUsdc(config?.stakeAmt)} USDC</strong></div>
                <div><span>Duration</span><strong>{secondsToLabel(config?.challengeDuration)}</strong></div>
                <div><span>Steal opens</span><strong>after {secondsToLabel(config?.stealGracePeriod)}</strong></div>
                <div><span>Steal bounty</span><strong>{formatUsdc(config?.stealBounty)} USDC</strong></div>
                <div><span>Success fee</span><strong>{formatUsdc(config?.friendshipSuccessFee)} USDC</strong></div>
                <div><span>Cancel fee</span><strong>{formatUsdc(config?.cancelPendingStakeFee)} USDC</strong></div>
                <div><span>Reject fee</span><strong>{formatUsdc(config?.rejectPendingStakeFee)} USDC</strong></div>
                <div><span>Match fee</span><strong>{formatUsdc(config?.matchFee)} USDC</strong></div>
                <div><span>Match window</span><strong>{secondsToLabel(config?.matchTimeLimit)}</strong></div>
                <div><span>Queue cancel fee</span><strong>{formatUsdc(config?.matchQueueCancelFee)} USDC</strong></div>
              </div>
              <p>Two accounts stake USDC. If both make it through the challenge window without stealing, the friendship is finalized and stakes are returned.</p>
            </div>
          ) : null}

          {isOwner ? (
            <button className="menuRow" onClick={() => { onClose(); onOpenAdmin() }}>
              <Settings size={17} />
              <span className="menuRowLabel">Admin settings</span>
              <span className="menuOwnerBadge">Owner</span>
              <ChevronRight size={16} />
            </button>
          ) : null}
        </div>

        <div className="menuFooter">
          <span className="menuFooterAddress">{shortAddress(account, 6)}</span>
          <button className="menuDisconnect" onClick={() => { onClose(); onDisconnect() }}>
            <LogOut size={14} /> Disconnect
          </button>
        </div>
      </div>
    </Sheet>
  )
}
