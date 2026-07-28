import type { ContractConfig } from '../types'
import { durationLabelOrDash, formatUsdcOrDash, secondsToLabelOrDash } from '../lib/format'
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
// Configuration that has not been read yet is unknown, not zero.
function usdc(value?: bigint) {
  return value === undefined ? formatUsdcOrDash(undefined) : `${formatUsdcOrDash(value)} USDC`
}

export function TermsSheet({ open, config, onClose }: TermsSheetProps) {
  return (
    <Sheet open={open} title="Protocol terms" description={`Live contract settings on ${appConfig.chainName}`} onClose={onClose}>
      <div className="formStack">
        <dl className="factList">
          <div><dt>Stake</dt><dd>{usdc(config?.stakeAmt)}</dd></div>
          <div><dt>Challenge duration</dt><dd>{secondsToLabelOrDash(config?.challengeDuration)}</dd></div>
          <div><dt>Steal opens</dt><dd>{config ? `after ${secondsToLabelOrDash(config.stealGracePeriod)}` : secondsToLabelOrDash(undefined)}</dd></div>
          <div><dt>Steal bounty</dt><dd>{usdc(config?.stealBounty)}</dd></div>
          <div><dt>Success fee</dt><dd>{usdc(config?.friendshipSuccessFee)}</dd></div>
          <div><dt>Cancel fee</dt><dd>{usdc(config?.cancelPendingStakeFee)}</dd></div>
          <div><dt>Reject fee</dt><dd>{usdc(config?.rejectPendingStakeFee)}</dd></div>
          <div><dt>Match fee</dt><dd>{usdc(config?.matchFee)}</dd></div>
          <div><dt>Match window</dt><dd>{durationLabelOrDash(config?.matchTimeLimit)}</dd></div>
          <div><dt>Queue cancel fee</dt><dd>{usdc(config?.matchQueueCancelFee)}</dd></div>
          <div><dt>Rewards pool</dt><dd>{usdc(config?.bonusPool)}</dd></div>
        </dl>
        <p className="quietCaption">
          Two accounts stake USDC. If both make it through the challenge window without stealing, the friendship is
          finalized and stakes are returned.
        </p>
      </div>
    </Sheet>
  )
}
