import type { ContractConfig } from '../types'
import { formatUsdc, secondsToLabel } from '../lib/format'
import { appConfig } from '../lib/config'
import { Sheet } from './Sheet'

type TermsSheetProps = {
  open: boolean
  config?: ContractConfig
  onClose: () => void
}

/**
 * The live protocol parameters, read from the contract. Previously buried in
 * the three-dot menu; now a row in Account.
 */
export function TermsSheet({ open, config, onClose }: TermsSheetProps) {
  return (
    <Sheet open={open} title="Protocol terms" description={`Live contract settings on ${appConfig.chainName}`} onClose={onClose}>
      <div className="formStack">
        <dl className="factList">
          <div><dt>Stake</dt><dd>{formatUsdc(config?.stakeAmt)} USDC</dd></div>
          <div><dt>Challenge duration</dt><dd>{secondsToLabel(config?.challengeDuration)}</dd></div>
          <div><dt>Steal opens</dt><dd>after {secondsToLabel(config?.stealGracePeriod)}</dd></div>
          <div><dt>Steal bounty</dt><dd>{formatUsdc(config?.stealBounty)} USDC</dd></div>
          <div><dt>Success fee</dt><dd>{formatUsdc(config?.friendshipSuccessFee)} USDC</dd></div>
          <div><dt>Cancel fee</dt><dd>{formatUsdc(config?.cancelPendingStakeFee)} USDC</dd></div>
          <div><dt>Reject fee</dt><dd>{formatUsdc(config?.rejectPendingStakeFee)} USDC</dd></div>
          <div><dt>Match fee</dt><dd>{formatUsdc(config?.matchFee)} USDC</dd></div>
          <div><dt>Match window</dt><dd>{secondsToLabel(config?.matchTimeLimit)}</dd></div>
          <div><dt>Queue cancel fee</dt><dd>{formatUsdc(config?.matchQueueCancelFee)} USDC</dd></div>
          <div><dt>Rewards pool</dt><dd>{formatUsdc(config?.bonusPool)} USDC</dd></div>
        </dl>
        <p className="quietCaption">
          Two accounts stake USDC. If both make it through the challenge window without stealing, the friendship is
          finalized and stakes are returned.
        </p>
      </div>
    </Sheet>
  )
}
