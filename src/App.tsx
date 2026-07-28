import { useCallback, useEffect, useMemo, useState } from 'react'
import type { Address } from 'viem'
import { ArrowLeft, Pencil, Plus, RefreshCw } from 'lucide-react'
import { formatUsdc } from './lib/format'
import { parseRoute, tabForRoute } from './lib/routes'
import { appConfig } from './lib/config'
import type { ChallengeView } from './types'
import { useSocialTrust } from './hooks/useSocialTrust'
import { useLiveNow } from './hooks/useLiveNow'
import { HomePage } from './pages/HomePage'
import { FriendsPage } from './pages/FriendsPage'
import { ActivityPage } from './pages/ActivityPage'
import { AccountPage } from './pages/AccountPage'
import { PublicProfilePage } from './pages/PublicProfilePage'
import { BottomNav } from './components/BottomNav'
import { TopBar } from './components/TopBar'
import { StartFriendshipSheet } from './components/StartFriendshipSheet'
import { WalletSheet } from './components/WalletSheet'
import { ChallengeDetailSheet } from './components/ChallengeDetailSheet'
import { AdminSheet } from './components/AdminSheet'
import { ProfileEditSheet } from './components/ProfileEditSheet'
import { ShareProfileSheet } from './components/ShareProfileSheet'
import { TermsSheet } from './components/TermsSheet'
import { Toast } from './components/Toast'
import { ProfileAvatar } from './components/ProfileAvatar'

function getPath() {
  return window.location.pathname || '/'
}

function App() {
  const {
    account,
    isConnected,
    isLoading,
    isOwner,
    wrongNetwork,
    config,
    snapshot,
    activityError,
    tx,
    connect,
    disconnect,
    switchToAppNetwork,
    refresh,
    readAccountProfile,
    readSocialProfile,
    actions,
    clearTx,
  } = useSocialTrust()

  const [path, setPath] = useState(getPath())
  const [startOpen, setStartOpen] = useState(false)
  const [startOther, setStartOther] = useState<string | undefined>()
  const [walletOpen, setWalletOpen] = useState(false)
  const [walletTab, setWalletTab] = useState<'deposit' | 'withdraw'>('deposit')
  const [adminOpen, setAdminOpen] = useState(false)
  const [profileEditOpen, setProfileEditOpen] = useState(false)
  const [qrOpen, setQrOpen] = useState(false)
  const [termsOpen, setTermsOpen] = useState(false)
  const [selectedChallengeKey, setSelectedChallengeKey] = useState<ChallengeView['pairKey'] | undefined>()
  const nowSeconds = useLiveNow()

  useEffect(() => {
    const onPop = () => setPath(getPath())
    window.addEventListener('popstate', onPop)
    return () => window.removeEventListener('popstate', onPop)
  }, [])

  const navigate = useCallback((to: string) => {
    if (to === (window.location.pathname || '/')) {
      window.scrollTo({ top: 0 })
      return
    }
    window.history.pushState({}, '', to)
    setPath(to)
    window.scrollTo({ top: 0 })
  }, [])

  const route = useMemo(() => parseRoute(path), [path])
  const activeTab = tabForRoute(route)

  const selectedChallenge = useMemo(() => {
    if (!selectedChallengeKey) return undefined
    return snapshot?.challenges.find((challenge) => challenge.pairKey.toLowerCase() === selectedChallengeKey.toLowerCase())
  }, [selectedChallengeKey, snapshot?.challenges])

  useEffect(() => {
    if (selectedChallengeKey && snapshot && !selectedChallenge) setSelectedChallengeKey(undefined)
  }, [selectedChallenge, selectedChallengeKey, snapshot])

  // A route change closes any open sheet, so Back never lands on a stale modal.
  useEffect(() => {
    setStartOpen(false)
    setWalletOpen(false)
    setAdminOpen(false)
    setProfileEditOpen(false)
    setQrOpen(false)
    setTermsOpen(false)
    setSelectedChallengeKey(undefined)
  }, [path])

  const openChallenge = (challenge: ChallengeView) => setSelectedChallengeKey(challenge.pairKey)

  const finalize = (challenge: ChallengeView) => actions.finalizeFriendship(challenge.other)
  const accept = (challenge: ChallengeView) => {
    const appBalance = snapshot?.appBalance ?? 0n
    const missingStake = challenge.stakeAmount > appBalance ? challenge.stakeAmount - appBalance : 0n
    if (missingStake > 0n) return actions.depositAndStakeForFriendship(challenge.other, formatUsdc(missingStake))
    return actions.stakeForFriendship(challenge.other)
  }
  const reject = (challenge: ChallengeView) => actions.rejectPendingStake(challenge.other)
  const cancel = (challenge: ChallengeView) => actions.cancelPendingStake(challenge.other)
  const steal = (challenge: ChallengeView) => actions.steal(challenge.other)

  const startWith = (address?: string) => {
    setStartOther(address)
    setStartOpen(true)
  }

  const openWallet = (tab: 'deposit' | 'withdraw') => {
    setWalletTab(tab)
    setWalletOpen(true)
  }

  const sheetOpen = startOpen || walletOpen || adminOpen || profileEditOpen || qrOpen || termsOpen || Boolean(selectedChallenge)

  const connectedHeaderMetrics = isConnected && account ? (
    <div className="topBarMetrics">
      <span className="metric" aria-label={`App balance ${formatUsdc(snapshot?.appBalance, { truncate: true })} USDC`}>
        <span className="metricSymbol metricSymbolUsdc" aria-hidden="true">$</span>
        {formatUsdc(snapshot?.appBalance, { truncate: true })}
      </span>
      <span className="metric" aria-label={`Reputation ${String(snapshot?.repScore ?? 0n)}`}>
        <span className="metricSymbol metricSymbolRep" aria-hidden="true">{'★︎'}</span>
        {String(snapshot?.repScore ?? 0n)}
      </span>
    </div>
  ) : null

  const header = (() => {
    if (route.name === 'home') {
      if (!isConnected || !account) {
        return (
          <TopBar
            left={<span className="brandWordmark">SocialTrust</span>}
            actions={<button className="walletButton" type="button" onClick={connect}>Connect wallet</button>}
          />
        )
      }
      return (
        <TopBar
          left={
            <>
              <button className="avatarButton" type="button" aria-label="Open your account" onClick={() => navigate('/me')}>
                <ProfileAvatar address={account} profile={snapshot?.socialProfile} size="sm" />
              </button>
              <span className="brandWordmark brandWordmarkCompact">SocialTrust</span>
            </>
          }
          actions={connectedHeaderMetrics}
        />
      )
    }

    if (route.name === 'friends') {
      return (
        <TopBar
          title="Friends"
          actions={
            <button
              className="iconButton"
              type="button"
              aria-label="Start friendship"
              title="Start friendship"
              onClick={() => startWith(undefined)}
            >
              <Plus size={20} aria-hidden="true" />
            </button>
          }
        />
      )
    }

    if (route.name === 'activity') {
      return (
        <TopBar
          title="Activity"
          actions={
            <button className="iconButton" type="button" aria-label="Refresh activity" title="Refresh activity" onClick={refresh}>
              <RefreshCw size={18} aria-hidden="true" className={isLoading ? 'spin' : undefined} />
            </button>
          }
        />
      )
    }

    if (route.name === 'me') {
      return (
        <TopBar
          title="Account"
          actions={
            isConnected && account ? (
              <button className="iconButton" type="button" aria-label="Edit profile" title="Edit profile" onClick={() => setProfileEditOpen(true)}>
                <Pencil size={18} aria-hidden="true" />
              </button>
            ) : null
          }
        />
      )
    }

    if (route.name === 'account') {
      return (
        <TopBar
          left={
            <button
              className="iconButton"
              type="button"
              aria-label="Go back"
              onClick={() => (window.history.length > 1 ? window.history.back() : navigate('/friends'))}
            >
              <ArrowLeft size={20} aria-hidden="true" />
            </button>
          }
          title="Profile"
        />
      )
    }

    return <TopBar left={<span className="brandWordmark">SocialTrust</span>} />
  })()

  return (
    <div className="app">
      {header}

      {wrongNetwork ? (
        <div className="networkBanner" role="status">
          <span>Your wallet is on the wrong network.</span>
          <button className="linkButton" type="button" onClick={switchToAppNetwork}>Switch to {appConfig.chainName}</button>
        </div>
      ) : null}

      <main className="appMain">
        {route.name === 'home' ? (
          <HomePage
            account={account}
            isConnected={isConnected}
            config={config}
            snapshot={snapshot}
            isLoading={isLoading}
            onConnect={connect}
            onStartWith={(address) => startWith(address)}
            onFindMatch={actions.matchMe}
            onDepositAndMatchMe={actions.depositAndMatchMe}
            onCancelMatch={actions.cancelMatchMe}
            readSocialProfile={readSocialProfile}
            onSetProfile={actions.setProfile}
            txPending={tx.pending}
            onOpenChallenge={openChallenge}
            onFinalize={finalize}
            onAccept={accept}
            onReject={reject}
            onCancel={cancel}
            onNavigate={navigate}
            nowSeconds={nowSeconds}
          />
        ) : null}

        {route.name === 'friends' ? (
          <FriendsPage
            isConnected={isConnected}
            snapshot={snapshot}
            isLoading={isLoading}
            txPending={tx.pending}
            nowSeconds={nowSeconds}
            onConnect={connect}
            onStartFriendship={() => startWith(undefined)}
            onOpenChallenge={openChallenge}
            onFinalize={finalize}
            onAccept={accept}
            onReject={reject}
            onCancel={cancel}
            onNavigate={navigate}
          />
        ) : null}

        {route.name === 'activity' ? (
          <ActivityPage
            isConnected={isConnected}
            snapshot={snapshot}
            isLoading={isLoading}
            activityError={activityError}
            nowSeconds={nowSeconds}
            onConnect={connect}
            onRetry={refresh}
            onNavigate={navigate}
          />
        ) : null}

        {route.name === 'me' ? (
          <AccountPage
            account={account}
            isConnected={isConnected}
            isOwner={isOwner}
            snapshot={snapshot}
            config={config}
            wrongNetwork={wrongNetwork}
            onConnect={connect}
            onEditProfile={() => setProfileEditOpen(true)}
            onShowQr={() => setQrOpen(true)}
            onOpenWallet={openWallet}
            onOpenAdmin={() => setAdminOpen(true)}
            onOpenTerms={() => setTermsOpen(true)}
            onSwitchNetwork={switchToAppNetwork}
            onDisconnect={disconnect}
          />
        ) : null}

        {route.name === 'account' ? (
          <PublicProfilePage
            address={route.address}
            connectedAccount={account}
            isConnected={isConnected}
            readAccountProfile={readAccountProfile}
            onConnect={connect}
            onStartWith={(address: Address) => startWith(address)}
            onOpenChallenge={openChallenge}
            onNavigate={navigate}
            nowSeconds={nowSeconds}
          />
        ) : null}

        {route.name === 'not-found' ? (
          <div className="pageStack">
            <section className="emptyPanel">
              <h2>Page not found</h2>
              <p>Try Home, Friends, Activity, or Account — or open a profile with /account/0x…</p>
              <button className="primaryButton full" type="button" onClick={() => navigate('/')}>Go home</button>
            </section>
          </div>
        ) : null}
      </main>

      <BottomNav activeTab={activeTab} onNavigate={navigate} inactive={sheetOpen} />

      <StartFriendshipSheet
        open={startOpen}
        initialOther={startOther}
        account={account}
        config={config}
        snapshot={snapshot}
        isConnected={isConnected}
        onClose={() => setStartOpen(false)}
        onConnect={connect}
        onStake={actions.stakeForFriendship}
        onDepositAndStake={actions.depositAndStakeForFriendship}
        readSocialProfile={readSocialProfile}
      />

      <WalletSheet
        open={walletOpen}
        snapshot={snapshot}
        initialTab={walletTab}
        onClose={() => setWalletOpen(false)}
        onDeposit={actions.deposit}
        onWithdraw={actions.withdraw}
      />

      <ChallengeDetailSheet
        challenge={selectedChallenge}
        profile={selectedChallenge ? snapshot?.friendProfiles?.[selectedChallenge.other.toLowerCase()] : undefined}
        appBalance={snapshot?.appBalance}
        onClose={() => setSelectedChallengeKey(undefined)}
        onFinalize={finalize}
        onAccept={accept}
        onReject={reject}
        onCancel={cancel}
        onSteal={steal}
        onNavigateAccount={(address) => {
          setSelectedChallengeKey(undefined)
          navigate(`/account/${address}`)
        }}
        nowSeconds={nowSeconds}
      />

      <ProfileEditSheet
        open={profileEditOpen}
        loadProfile={() => {
          if (!account) return Promise.reject(new Error('Connect your wallet first.'))
          return readSocialProfile(account)
        }}
        onClose={() => setProfileEditOpen(false)}
        onSave={actions.setProfile}
      />

      <ShareProfileSheet open={qrOpen} account={account} onClose={() => setQrOpen(false)} />

      <TermsSheet open={termsOpen} config={config} onClose={() => setTermsOpen(false)} />

      <AdminSheet
        open={adminOpen}
        config={config}
        onClose={() => setAdminOpen(false)}
        onSetChallengeConfig={actions.setChallengeConfig}
        onSetBonusConfig={actions.setBonusConfig}
        onSetScore={actions.setScore}
      />

      <Toast tx={tx} onClear={clearTx} />
    </div>
  )
}

export default App
