import type { Address } from 'viem'
import type { AccountProfile, ActivityItem, ChallengeView, ContractConfig, SocialProfile, UserSnapshot } from '../types'

const user = '0x91a42a42a42a42a42a42a42a42a42a42a42aa42' as Address
const otherA = '0xb7f88f88f88f88f88f88f88f88f88f88f88f88f8' as Address
const otherB = '0xc411d11d11d11d11d11d11d11d11d11d11d11d11' as Address
const otherC = '0xa82f12f12f12f12f12f12f12f12f12f12f12f12f' as Address
const otherD = '0x44a19a19a19a19a19a19a19a19a19a19a19a19a1' as Address
const otherE = '0x72e91e91e91e91e91e91e91e91e91e91e91e91e9' as Address
const otherF = '0xf001f001f001f001f001f001f001f001f001f001' as Address

const mockProfiles: Record<string, SocialProfile> = {
  [user.toLowerCase()]: { displayName: 'Jamie', xUsername: 'jamie_judd', telegramUsername: 'jamiejudd', discordUsername: '', imgUrl: '', exists: true },
  [otherA.toLowerCase()]: { displayName: 'Morgan', xUsername: 'morgan_trust', telegramUsername: 'morgantrust', discordUsername: '', imgUrl: '', exists: true },
  [otherB.toLowerCase()]: { displayName: 'Casey', xUsername: '', telegramUsername: 'casey_chain', discordUsername: '', imgUrl: '', exists: true },
  [otherC.toLowerCase()]: { displayName: 'Riley', xUsername: 'riley_demo', telegramUsername: '', discordUsername: '', imgUrl: '', exists: true },
}

const mockRepScores: Record<string, bigint> = {
  [user.toLowerCase()]: 82n,
  [otherA.toLowerCase()]: 82n,
  [otherB.toLowerCase()]: 44n,
  [otherC.toLowerCase()]: 61n,
  [otherD.toLowerCase()]: 36n,
  [otherE.toLowerCase()]: 58n,
  [otherF.toLowerCase()]: 41n,
}

function key(id: string) {
  return `0x${id.padEnd(64, '0')}` as `0x${string}`
}

const now = BigInt(Math.floor(Date.now() / 1000))
const stake = 25_000_000n

export const mockUser = user

export const mockConfig: ContractConfig = {
  stakeAmt: stake,
  cancelPendingStakeFee: 1_000_000n,
  rejectPendingStakeFee: 1_000_000n,
  challengeDuration: 120n,
  stealGracePeriod: 30n,
  stealBounty: 35_000_000n,
  friendshipSuccessFee: 0n,
  payoutBps: 1_000n,
  maxTreasurySpendBps: 500n,
  maxBonusPerSuccess: 10_000_000n,
  matchFee: 3_000_000n,
  matchTimeLimit: 14n * 24n * 60n * 60n,
  maxMatchScan: 10n,
  matchQueueCancelFee: 1_000_000n,
  bonusPool: 2_450_000_000n,
  totalBonusPaid: 18_750_000n,
  owner: user,
}

export const mockChallenges: ChallengeView[] = [
  {
    pairKey: key('01'), account0: user, account1: otherA, other: otherA,
    stakeAmount: stake, cancelPendingStakeFee: mockConfig.cancelPendingStakeFee, rejectPendingStakeFee: mockConfig.rejectPendingStakeFee, challengeDuration: mockConfig.challengeDuration, stealGracePeriod: mockConfig.stealGracePeriod, stealBounty: mockConfig.stealBounty, friendshipSuccessFee: mockConfig.friendshipSuccessFee,
    userStaked: true, otherStaked: true, active: false, challengeStartedAt: now - mockConfig.challengeDuration - 15n, stealAllowedAt: now - 90n, challengeEndsAt: now - 15n,
  },
  {
    pairKey: key('02'), account0: user, account1: otherB, other: otherB,
    stakeAmount: stake, cancelPendingStakeFee: mockConfig.cancelPendingStakeFee, rejectPendingStakeFee: mockConfig.rejectPendingStakeFee, challengeDuration: mockConfig.challengeDuration, stealGracePeriod: mockConfig.stealGracePeriod, stealBounty: mockConfig.stealBounty, friendshipSuccessFee: mockConfig.friendshipSuccessFee,
    userStaked: false, otherStaked: true, active: false, challengeStartedAt: 0n, stealAllowedAt: 0n, challengeEndsAt: 0n,
  },
  {
    pairKey: key('03'), account0: user, account1: otherC, other: otherC,
    stakeAmount: stake, cancelPendingStakeFee: mockConfig.cancelPendingStakeFee, rejectPendingStakeFee: mockConfig.rejectPendingStakeFee, challengeDuration: mockConfig.challengeDuration, stealGracePeriod: mockConfig.stealGracePeriod, stealBounty: mockConfig.stealBounty, friendshipSuccessFee: mockConfig.friendshipSuccessFee,
    userStaked: true, otherStaked: true, active: true, challengeStartedAt: now - 15n, stealAllowedAt: now + 15n, challengeEndsAt: now + 105n,
  },
  {
    pairKey: key('04'), account0: user, account1: otherD, other: otherD,
    stakeAmount: stake, cancelPendingStakeFee: mockConfig.cancelPendingStakeFee, rejectPendingStakeFee: mockConfig.rejectPendingStakeFee, challengeDuration: mockConfig.challengeDuration, stealGracePeriod: mockConfig.stealGracePeriod, stealBounty: mockConfig.stealBounty, friendshipSuccessFee: mockConfig.friendshipSuccessFee,
    userStaked: true, otherStaked: false, active: false, challengeStartedAt: 0n, stealAllowedAt: 0n, challengeEndsAt: 0n,
  },
  {
    pairKey: key('05'), account0: user, account1: otherE, other: otherE,
    stakeAmount: stake, cancelPendingStakeFee: mockConfig.cancelPendingStakeFee, rejectPendingStakeFee: mockConfig.rejectPendingStakeFee, challengeDuration: mockConfig.challengeDuration, stealGracePeriod: mockConfig.stealGracePeriod, stealBounty: mockConfig.stealBounty, friendshipSuccessFee: mockConfig.friendshipSuccessFee,
    userStaked: true, otherStaked: true, active: true, challengeStartedAt: now - 45n, stealAllowedAt: now - 15n, challengeEndsAt: now + 75n,
  },
]


export const mockRecentActivity: ActivityItem[] = [
  {
    id: 'mock-finalized-1',
    kind: 'finalized',
    title: 'Friendship finalized',
    detail: 'Stakes returned and friendship recorded',
    other: otherA,
    amount: stake,
    timestamp: now - 90n,
  },
  {
    id: 'mock-invite-1',
    kind: 'invite',
    title: 'Invite received',
    detail: 'They staked with you',
    other: otherB,
    amount: stake,
    timestamp: now - 240n,
  },
  {
    id: 'mock-deposit-1',
    kind: 'deposit',
    title: 'Deposit',
    amount: 50_000_000n,
    timestamp: now - 600n,
  },
  {
    id: 'mock-started-1',
    kind: 'challenge_started',
    title: 'Challenge started',
    detail: 'Both accounts staked',
    other: otherC,
    amount: stake,
    timestamp: now - 15n,
  },
  {
    id: 'mock-waiting-1',
    kind: 'stake',
    title: 'Invite sent',
    detail: 'Stake placed',
    other: otherD,
    amount: stake,
    timestamp: now - 900n,
  },
]

export const mockSnapshot: UserSnapshot = {
  walletUsdc: 312_400_000n,
  appBalance: 124_500_000n,
  pendingBonus: 3_420_000n,
  bonusPaidTo: 18_750_000n,
  repScore: 82n,
  allowance: 0n,
  friendCount: 12n,
  friends: [otherA, otherB, otherC, otherF],
  owner: user,
  socialProfile: mockProfiles[user.toLowerCase()],
  friendProfiles: Object.fromEntries([otherA, otherB, otherC, otherF].map((friend) => [friend.toLowerCase(), mockProfiles[friend.toLowerCase()] ?? { displayName: '', xUsername: '', telegramUsername: '', discordUsername: '', imgUrl: '', exists: false }])),
  friendRepScores: Object.fromEntries([otherA, otherB, otherC, otherF].map((friend) => [friend.toLowerCase(), mockRepScores[friend.toLowerCase()] ?? 0n])),
  challenges: mockChallenges,
  recentActivity: mockRecentActivity,
}

function reversePerspective(challenge: ChallengeView): ChallengeView {
  return {
    ...challenge,
    other: user,
    userStaked: challenge.otherStaked,
    otherStaked: challenge.userStaked,
  }
}

export function mockProfile(address: Address): AccountProfile {
  const ownedChallenge = mockChallenges.find((challenge) => challenge.other.toLowerCase() === address.toLowerCase())
  const isSelf = address.toLowerCase() === user.toLowerCase()
  const profileChallenges = isSelf ? mockChallenges : ownedChallenge ? [reversePerspective(ownedChallenge)] : []

  return {
    address,
    friendCount: isSelf ? mockSnapshot.friendCount : address.toLowerCase() === otherF.toLowerCase() ? 3n : 8n,
    challengeCount: BigInt(profileChallenges.length),
    repScore: mockRepScores[address.toLowerCase()] ?? (isSelf ? mockSnapshot.repScore : 61n),
    pendingBonus: isSelf ? mockSnapshot.pendingBonus : 1_250_000n,
    bonusPaidTo: isSelf ? mockSnapshot.bonusPaidTo : 4_500_000n,
    friends: isSelf ? mockSnapshot.friends : [user, otherA, otherF].filter((friend) => friend.toLowerCase() !== address.toLowerCase()) as Address[],
    challenges: profileChallenges,
    appBalance: isSelf ? mockSnapshot.appBalance : undefined,
    walletUsdc: isSelf ? mockSnapshot.walletUsdc : undefined,
    allowance: isSelf ? mockSnapshot.allowance : undefined,
    owner: mockConfig.owner,
    isFriendWithViewer: isSelf ? undefined : mockSnapshot.friends.some((friend) => friend.toLowerCase() === address.toLowerCase()),
    relationshipChallenge: isSelf ? undefined : ownedChallenge,
    socialProfile: mockProfiles[address.toLowerCase()] ?? { displayName: '', xUsername: '', telegramUsername: '', discordUsername: '', imgUrl: '', exists: false },
    friendProfiles: Object.fromEntries((isSelf ? mockSnapshot.friends : [user, otherA, otherF]).map((friend) => [friend.toLowerCase(), mockProfiles[friend.toLowerCase()] ?? { displayName: '', xUsername: '', telegramUsername: '', discordUsername: '', imgUrl: '', exists: false }])),
    friendRepScores: Object.fromEntries((isSelf ? mockSnapshot.friends : [user, otherA, otherF]).map((friend) => [friend.toLowerCase(), mockRepScores[friend.toLowerCase()] ?? 0n])),
  }
}
