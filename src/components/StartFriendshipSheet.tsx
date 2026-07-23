import { useEffect, useMemo, useRef, useState } from 'react'
import { Check, Copy, ScanLine } from 'lucide-react'
import jsQR from 'jsqr'
import { QRCodeSVG } from 'qrcode.react'
import type { ContractConfig, UserSnapshot } from '../types'
import { copyText, formatUsdc, isAddressLike, sameAddress, secondsToLabel, shortAddress } from '../lib/format'
import { Sheet } from './Sheet'

type StartFriendshipSheetProps = {
  open: boolean
  initialOther?: string
  account?: string
  config?: ContractConfig
  snapshot?: UserSnapshot
  isConnected: boolean
  onClose: () => void
  onConnect: () => void
  onStake: (other: string) => Promise<boolean>
  onDepositAndStake: (other: string, amount: string) => Promise<boolean>
}

type ScanState = 'idle' | 'starting' | 'active' | 'scanned' | 'error'

function extractAddress(payload: string): string | undefined {
  let candidate = payload.trim()
  if (candidate.toLowerCase().startsWith('ethereum:')) candidate = candidate.slice('ethereum:'.length)
  if (candidate.toLowerCase().startsWith('pay-')) candidate = candidate.slice('pay-'.length)
  candidate = candidate.split('@')[0].split('?')[0]
  return isAddressLike(candidate) ? candidate : undefined
}

export function StartFriendshipSheet({ open, initialOther, account, config, snapshot, isConnected, onClose, onConnect, onStake, onDepositAndStake }: StartFriendshipSheetProps) {
  const [tab, setTab] = useState<'scan' | 'show'>('scan')
  const [scanState, setScanState] = useState<ScanState>('idle')
  const [other, setOther] = useState(initialOther ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [copied, setCopied] = useState(false)

  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rafRef = useRef(0)
  // Generation counter: a getUserMedia that resolves after the sheet closed or
  // the tab switched must not attach its (still live) stream.
  const camGenRef = useRef(0)
  const copiedTimerRef = useRef<number | undefined>(undefined)

  const stopCamera = () => {
    camGenRef.current += 1
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }

  const tick = () => {
    const video = videoRef.current
    if (video && video.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && video.videoWidth > 0) {
      const canvas = (canvasRef.current ??= document.createElement('canvas'))
      canvas.width = video.videoWidth
      canvas.height = video.videoHeight
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const image = ctx.getImageData(0, 0, canvas.width, canvas.height)
        const code = jsQR(image.data, image.width, image.height)
        const address = code ? extractAddress(code.data) : undefined
        if (address) {
          setOther(address)
          stopCamera()
          setScanState('scanned')
          return
        }
      }
    }
    rafRef.current = requestAnimationFrame(tick)
  }

  const startCamera = async () => {
    const gen = ++camGenRef.current
    setScanState('starting')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } })
      if (gen !== camGenRef.current || !videoRef.current) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }
      streamRef.current = stream
      videoRef.current.srcObject = stream
      await videoRef.current.play()
      setScanState('active')
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      setScanState('error')
    }
  }

  const switchTab = (next: 'scan' | 'show') => {
    stopCamera()
    setScanState((state) => (state === 'scanned' ? state : 'idle'))
    setTab(next)
  }

  useEffect(() => {
    if (open) {
      setOther(initialOther ?? '')
    } else {
      stopCamera()
      setTab('scan')
      setScanState('idle')
      setCopied(false)
    }
  }, [initialOther, open])

  useEffect(() => () => {
    stopCamera()
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
  }, [])

  const stake = config?.stakeAmt ?? 0n
  const appBalance = snapshot?.appBalance ?? 0n
  const missingStake = stake > appBalance ? stake - appBalance : 0n
  const hasEnough = Boolean(snapshot && appBalance >= stake)
  const otherValid = useMemo(() => isAddressLike(other) && !sameAddress(other, account), [other, account])

  const submitStake = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const success = await onStake(other)
      if (success) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const submitDepositAndStake = async () => {
    if (submitting) return
    setSubmitting(true)
    try {
      const success = await onDepositAndStake(other, formatUsdc(missingStake))
      if (success) onClose()
    } finally {
      setSubmitting(false)
    }
  }

  const handleCopy = async () => {
    if (!account) return
    await copyText(account)
    setCopied(true)
    if (copiedTimerRef.current !== undefined) window.clearTimeout(copiedTimerRef.current)
    copiedTimerRef.current = window.setTimeout(() => setCopied(false), 1400)
  }

  const actionBlock = (
    <>
      <button
        className="trustButton full"
        disabled={!otherValid || submitting}
        onClick={hasEnough ? submitStake : submitDepositAndStake}
      >
        {submitting ? 'Confirming…' : hasEnough ? `Stake ${formatUsdc(stake)} USDC` : `Deposit ${formatUsdc(missingStake)} & stake`}
      </button>
      {hasEnough ? (
        <p className="sheetCaption">
          {secondsToLabel(config?.challengeDuration)} challenge · Balance: <span className="captionBalance">$ {formatUsdc(appBalance, { compact: true })}</span>
        </p>
      ) : (
        <p className="sheetCaption">Deposits {formatUsdc(missingStake)} USDC from your wallet to cover the stake.</p>
      )}
    </>
  )

  const addressField = (
    <label>
      <span className={initialOther ? undefined : 'pasteLabel'}>{initialOther ? 'Friend address' : 'Or paste their address'}</span>
      <input value={other} onChange={(event) => setOther(event.target.value)} placeholder="0x..." />
    </label>
  )

  return (
    <Sheet open={open} title="Start friendship" onClose={onClose}>
      {!isConnected ? (
        <div className="emptyState inset">
          <h3>Connect first</h3>
          <p>You need a wallet to start a friendship challenge.</p>
          <button className="primaryButton" onClick={onConnect}>Connect wallet</button>
        </div>
      ) : initialOther ? (
        <div className="formStack">
          {addressField}
          {actionBlock}
        </div>
      ) : (
        <div className="formStack">
          <div className="segmentedControl">
            <button
              className={`segmentedOption ${tab === 'scan' ? 'active' : ''}`}
              aria-pressed={tab === 'scan'}
              onClick={() => switchTab('scan')}
            >
              Scan their code
            </button>
            <button
              className={`segmentedOption ${tab === 'show' ? 'active' : ''}`}
              aria-pressed={tab === 'show'}
              onClick={() => switchTab('show')}
            >
              Show mine
            </button>
          </div>

          {tab === 'scan' ? (
            <>
              {scanState === 'scanned' ? (
                <div className="scanArea scanAreaDone">
                  <Check size={20} />
                  <span>{shortAddress(other)}</span>
                </div>
              ) : scanState === 'starting' || scanState === 'active' ? (
                <div className="scanArea scanAreaActive">
                  <video ref={videoRef} className="scanVideo" playsInline muted autoPlay />
                </div>
              ) : (
                <button type="button" className="scanArea" onClick={startCamera}>
                  <ScanLine size={30} />
                  <span>Tap to scan their QR</span>
                </button>
              )}
              {scanState === 'error' ? <p className="scanHint">Camera unavailable — paste the address below instead.</p> : null}

              {addressField}
              {actionBlock}
            </>
          ) : (
            <div className="qrPanel">
              <div className="qrCard">
                <QRCodeSVG value={account ?? ''} size={168} />
              </div>
              <div className="qrAddressRow">
                <span>{shortAddress(account)}</span>
                <button
                  className={`copyIconButton ${copied ? 'copied' : ''}`}
                  onClick={handleCopy}
                  aria-label={copied ? 'Address copied' : 'Copy address'}
                  title={copied ? 'Copied' : 'Copy address'}
                >
                  {copied ? <span>✓ Copied</span> : <Copy size={14} />}
                </button>
              </div>
              <p className="sheetCaption qrCaption">Have your friend scan this to stake toward you. You'll get an invite to stake back.</p>
            </div>
          )}
        </div>
      )}
    </Sheet>
  )
}
