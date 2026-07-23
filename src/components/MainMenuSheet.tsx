import { LogOut, Settings, WalletCards } from 'lucide-react'
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
  onOpenWallet: () => void
  onOpenAdmin: () => void
  onNavigate: (path: string) => void
}

export function MainMenuSheet({ open, account, isConnected, isOwner, config, onClose, onConnect, onDisconnect, onOpenWallet, onOpenAdmin, onNavigate }: MainMenuSheetProps) {
  return (
    <Sheet open={open} title="Menu" description="Money actions, protocol terms, and account settings." onClose={onClose}>
      <div className="menuStack">
        <section className="menuSection">
          <span className="eyebrow">Account</span>
          {isConnected && account ? (
            <div className="connectedRow">
              <div className="miniAvatar">{shortAddress(account, 2).slice(2, 4).toUpperCase()}</div>
              <div>
                <strong>{shortAddress(account, 6)}</strong>
                <span>Connected wallet</span>
              </div>
            </div>
          ) : (
            <button className="primaryButton full" onClick={onConnect}>Connect wallet</button>
          )}
          <div className="menuButtonGrid">
            <button className="secondaryButton" onClick={() => { onClose(); onOpenWallet() }}><WalletCards size={16} /> Deposit / withdraw</button>
            {account ? <button className="ghostButton" onClick={() => { onClose(); onDisconnect() }}><LogOut size={16} /> Disconnect wallet</button> : null}
          </div>
        </section>

        <section className="menuSection protocolTerms">
          <span className="eyebrow">Current parameters</span>
          <div className="termsBox smallTerms">
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
        </section>

        <section className="menuSection aboutBox">
          <span className="eyebrow">About</span>
          <h3>SocialTrust is a trust graph with real stakes.</h3>
          <p>Two accounts stake USDC. If both make it through the challenge window without stealing, the friendship is finalized and stakes are returned.</p>
        </section>

        {isOwner ? (
          <section className="menuSection">
            <span className="eyebrow">Owner</span>
            <button className="secondaryButton full" onClick={() => { onClose(); onOpenAdmin() }}><Settings size={16} /> Admin settings</button>
          </section>
        ) : null}
      </div>
    </Sheet>
  )
}
