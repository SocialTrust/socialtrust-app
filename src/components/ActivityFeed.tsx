import type { ActivityItem } from '../types'
import { formatUsdc, relativeTime, shortAddress } from '../lib/format'

type ActivityFeedProps = {
  items: ActivityItem[]
  onNavigateAccount: (address: string) => void
  nowSeconds: number
}

function money(value?: bigint, sign?: '+' | '-') {
  if (value === undefined) return undefined
  return `${sign ?? ''}${formatUsdc(value)} USDC`
}

function displayTitle(item: ActivityItem) {
  if (item.title === 'You stole the pot' || item.title === 'Pot was stolen' || item.title === 'Invite declined') return item.title

  switch (item.kind) {
    case 'deposit': return 'Deposit'
    case 'withdraw': return 'Withdrawal'
    case 'fund_bonus_pool': return 'Bonus pool funded'
    case 'stake': return 'Invite sent'
    case 'invite': return 'Invite received'
    case 'challenge_started': return 'Challenge started'
    case 'finalized': return 'Friendship finalized'
    case 'stolen': return item.title.toLowerCase().includes('you stole') ? 'You stole the pot' : 'Pot stolen'
    case 'cancelled': return 'Invite cancelled'
    case 'rejected': return item.amount && item.amount > 0n ? 'Invite declined' : 'Invite rejected'
    case 'bonus': return 'Trust bonus paid'
    default: return item.title || 'Contract activity'
  }
}

function subtitle(item: ActivityItem) {
  const amount = item.amount
  const other = item.other ? shortAddress(item.other) : undefined
  const prefix = other ? `${other} · ` : ''

  switch (item.kind) {
    case 'deposit': return money(amount, '+') ? `${money(amount, '+')} added to app balance` : 'App balance updated'
    case 'withdraw': return money(amount, '-') ? `${money(amount, '-')} sent to wallet` : 'Sent to wallet'
    case 'fund_bonus_pool': return amount !== undefined ? `${formatUsdc(amount)} USDC added to rewards pool` : 'Added to rewards pool'
    case 'stake': return `${prefix}${amount !== undefined ? `${formatUsdc(amount)} USDC staked` : 'stake placed'}`
    case 'invite': return `${prefix}${amount !== undefined ? `${formatUsdc(amount)} USDC staked with you` : 'invite received'}`
    case 'challenge_started': return `${prefix}both stakes locked`
    case 'finalized': {
      const stakeText = amount !== undefined ? `${money(amount, '+')} returned` : 'stake returned'
      const matchText = item.matchFeeRefund && item.matchFeeRefund > 0n ? ` + ${formatUsdc(item.matchFeeRefund)} USDC match fee` : ''
      const bonusText = item.detail?.toLowerCase().includes('rewards') && !matchText ? ' + rewards' : ''
      return `${prefix}${stakeText}${matchText}${bonusText}`
    }
    case 'stolen': {
      const title = displayTitle(item)
      if (title === 'You stole the pot') return `${prefix}${amount !== undefined ? `${money(amount, '+')} bounty` : 'bounty paid'}`
      if (title === 'Pot was stolen') return `${prefix}stake forfeited`
      return `${prefix}${amount !== undefined ? `${formatUsdc(amount)} USDC affected` : 'challenge ended by steal'}`
    }
    case 'cancelled': return `${prefix}${amount !== undefined ? `${money(amount, '+')} returned` : 'pending invite cancelled'}`
    case 'rejected': return amount && amount > 0n ? `${prefix}${money(amount, '+')} returned` : `${prefix}you declined`
    case 'bonus': return amount !== undefined ? `${money(amount, '+')} reward` : 'reward paid'
    default: return item.detail ?? (amount !== undefined ? `${formatUsdc(amount)} USDC` : 'Contract event')
  }
}


function renderSubtitleText(text: string) {
  const match = text.match(/\+[0-9,.]+(?:\.[0-9]+)? USDC/)
  if (!match || match.index === undefined) return text

  const before = text.slice(0, match.index)
  const value = match[0]
  const after = text.slice(match.index + value.length)

  return (
    <>
      {before}
      <span className="moneyPositive">{value}</span>
      {after}
    </>
  )
}

function activityTone(item: ActivityItem) {
  if (['deposit', 'finalized', 'bonus'].includes(item.kind)) return 'positive'
  if (item.kind === 'cancelled' || (item.kind === 'rejected' && item.amount && item.amount > 0n)) return 'positive'
  return ''
}

export function ActivityFeed({ items, onNavigateAccount, nowSeconds }: ActivityFeedProps) {
  if (items.length === 0) {
    return (
      <div className="quietEmpty activityEmpty">
        <strong>No activity yet</strong>
        <p>Deposits, invites, challenges, steals, and finalized friendships will appear here.</p>
      </div>
    )
  }

  return (
    <div className="activityList">
      {items.slice(0, 8).map((item) => (
        <article key={item.id} className={`activityItem ${item.kind} ${activityTone(item)}`}>
          <div className="activityTopLine">
            <strong>{displayTitle(item)}</strong>
            <small>{item.timestamp ? relativeTime(item.timestamp, nowSeconds) : item.blockNumber ? `Block ${item.blockNumber.toString()}` : 'recently'}</small>
          </div>
          <div className="activitySubLine">
            {item.other ? (
              <button onClick={() => onNavigateAccount(item.other!)}>{renderSubtitleText(subtitle(item))}</button>
            ) : (
              <span>{renderSubtitleText(subtitle(item))}</span>
            )}
          </div>
        </article>
      ))}
    </div>
  )
}
