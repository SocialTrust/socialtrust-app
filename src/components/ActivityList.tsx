import {
  ArrowDownLeft,
  ArrowUpRight,
  Clock,
  ExternalLink,
  Handshake,
  Inbox,
  Search,
  Send,
  Sparkles,
  Trophy,
  TriangleAlert,
  X,
  Zap,
} from 'lucide-react'
import type { Address } from 'viem'
import type { ActivityItem, SocialProfile } from '../types'
import { formatUsdc, relativeTime, shortAddress } from '../lib/format'
import { transactionUrl } from '../lib/config'
import { displayNameFor } from './ProfileAvatar'

type ActivityListProps = {
  items: ActivityItem[]
  profiles?: Record<string, SocialProfile>
  onNavigateAccount: (address: Address) => void
  nowSeconds: number
}

const ICONS = {
  deposit: ArrowDownLeft,
  withdraw: ArrowUpRight,
  fund_bonus_pool: Sparkles,
  stake: Send,
  invite: Inbox,
  challenge_started: Zap,
  finalized: Handshake,
  stolen: TriangleAlert,
  cancelled: X,
  rejected: X,
  bonus: Trophy,
  match: Search,
  transaction: Clock,
} as const

/** Preserved from the previous feed: the Graph mapping already set `title`. */
export function activityTitle(item: ActivityItem) {
  if (item.title === 'You stole the pot' || item.title === 'Pot was stolen' || item.title === 'Invite declined') return item.title

  switch (item.kind) {
    case 'deposit': return 'Deposit'
    case 'withdraw': return 'Withdrawal'
    case 'fund_bonus_pool': return 'Rewards pool funded'
    case 'stake': return 'Invite sent'
    case 'invite': return 'Invite received'
    case 'challenge_started': return 'Challenge started'
    case 'finalized': return 'Friendship finalized'
    case 'stolen': return item.title.toLowerCase().includes('you stole') ? 'You stole the pot' : 'Pot stolen'
    case 'cancelled': return 'Invite cancelled'
    case 'rejected': return item.amount && item.amount > 0n ? 'Invite declined' : 'Invite rejected'
    case 'bonus': return 'Reward paid'
    default: return item.title || 'Contract activity'
  }
}

/** Concise detail line, without the counterparty (rendered separately). */
export function activityDetail(item: ActivityItem) {
  switch (item.kind) {
    case 'deposit': return 'Added to app balance'
    case 'withdraw': return 'Sent to wallet'
    case 'fund_bonus_pool': return 'Added to rewards pool'
    case 'stake': return 'Stake placed'
    case 'invite': return 'They staked with you'
    case 'challenge_started': return 'Both stakes locked'
    case 'finalized': {
      const matchText = item.matchFeeRefund && item.matchFeeRefund > 0n
        ? `Stake returned + ${formatUsdc(item.matchFeeRefund)} USDC match fee`
        : undefined
      if (matchText) return matchText
      return item.detail?.toLowerCase().includes('rewards') ? 'Stake returned + rewards' : 'Stake returned'
    }
    case 'stolen': return activityTitle(item) === 'You stole the pot' ? 'Bounty paid' : 'Stake forfeited'
    case 'cancelled': return 'Stake returned'
    case 'rejected': return item.amount && item.amount > 0n ? 'Stake returned' : 'You declined'
    case 'bonus': return 'Reward credited'
    default: return item.detail ?? 'Contract event'
  }
}

function amountFor(item: ActivityItem): { text: string; tone: 'positive' | 'negative' | 'neutral' } | undefined {
  if (item.amount === undefined) return undefined
  const value = `${formatUsdc(item.amount)} USDC`

  switch (item.kind) {
    case 'deposit':
    case 'bonus':
    case 'finalized':
    case 'cancelled':
      return { text: `+${value}`, tone: 'positive' }
    case 'rejected':
      return item.amount > 0n ? { text: `+${value}`, tone: 'positive' } : undefined
    case 'withdraw':
      return { text: `-${value}`, tone: 'negative' }
    case 'stolen':
      return activityTitle(item) === 'You stole the pot'
        ? { text: `+${value}`, tone: 'positive' }
        : { text: `-${value}`, tone: 'negative' }
    default:
      return { text: value, tone: 'neutral' }
  }
}

export function ActivityList({ items, profiles, onNavigateAccount, nowSeconds }: ActivityListProps) {
  return (
    <ul className="activityList">
      {items.map((item) => {
        const Icon = ICONS[item.kind] ?? Clock
        const amount = amountFor(item)
        const counterparty = item.other
        const counterpartyName = counterparty ? displayNameFor(counterparty, profiles?.[counterparty.toLowerCase()]) : undefined
        const link = transactionUrl(item.txHash)

        return (
          <li key={item.id} className="activityRow">
            <span className={`activityIcon activityIcon-${item.kind}`} aria-hidden="true"><Icon size={17} /></span>
            <div className="activityCopy">
              <div className="activityTopLine">
                <strong>{activityTitle(item)}</strong>
                {amount ? <span className={`activityAmount amount-${amount.tone}`}>{amount.text}</span> : null}
              </div>
              <div className="activitySubLine">
                {counterparty ? (
                  <>
                    <button
                      className="linkButton activityCounterparty"
                      type="button"
                      onClick={() => onNavigateAccount(counterparty)}
                      title={shortAddress(counterparty, 6)}
                    >
                      {counterpartyName}
                    </button>
                    <span aria-hidden="true">·</span>
                  </>
                ) : null}
                <span className="activityDetail">{activityDetail(item)}</span>
                <time className="activityTime">
                  {item.timestamp ? relativeTime(item.timestamp, nowSeconds) : item.blockNumber ? `Block ${item.blockNumber}` : 'recently'}
                </time>
              </div>
            </div>
            {link ? (
              <a
                className="activityTxLink"
                href={link}
                target="_blank"
                rel="noreferrer noopener"
                aria-label={`View the ${activityTitle(item).toLowerCase()} transaction in the block explorer`}
              >
                <ExternalLink size={14} aria-hidden="true" />
              </a>
            ) : null}
          </li>
        )
      })}
    </ul>
  )
}
