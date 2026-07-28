import { useEffect, useRef, useState } from 'react'
import { Copy } from 'lucide-react'
import { QRCodeSVG } from 'qrcode.react'
import type { Address } from 'viem'
import { copyText, shortAddress } from '../lib/format'
import { Sheet } from './Sheet'

type ShareProfileSheetProps = {
  open: boolean
  account?: Address
  onClose: () => void
}

/** The connected user's own QR code and address, shown from Account. */
export function ShareProfileSheet({ open, account, onClose }: ShareProfileSheetProps) {
  const [copied, setCopied] = useState<'address' | 'link' | null>(null)
  const timerRef = useRef<number | undefined>(undefined)

  useEffect(() => () => {
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
  }, [])

  useEffect(() => {
    if (!open) setCopied(null)
  }, [open])

  const flash = (what: 'address' | 'link') => {
    setCopied(what)
    if (timerRef.current !== undefined) window.clearTimeout(timerRef.current)
    timerRef.current = window.setTimeout(() => setCopied(null), 1600)
  }

  const profileLink = account && typeof window !== 'undefined' ? `${window.location.origin}/account/${account}` : undefined

  return (
    <Sheet open={open} title="My QR code" description="Share this so someone can stake toward you." onClose={onClose}>
      <div className="qrPanel">
        <div className="qrCard">
          <QRCodeSVG value={account ?? ''} size={172} />
        </div>
        <div className="qrAddressRow">
          <span>{shortAddress(account, 6)}</span>
          <button
            className={`copyIconButton ${copied === 'address' ? 'copied' : ''}`}
            type="button"
            onClick={async () => { if (account) { await copyText(account); flash('address') } }}
            aria-label={copied === 'address' ? 'Address copied' : 'Copy address'}
            title={copied === 'address' ? 'Copied' : 'Copy address'}
          >
            {copied === 'address' ? <span>✓ Copied</span> : <Copy size={15} />}
          </button>
        </div>
        {profileLink ? (
          <button
            className="secondaryButton full"
            type="button"
            onClick={async () => { await copyText(profileLink); flash('link') }}
          >
            {copied === 'link' ? '✓ Profile link copied' : 'Copy profile link'}
          </button>
        ) : null}
        <p className="quietCaption">Your profile page is public. Anyone with the link can see your display name, handles, reputation, and friends.</p>
      </div>
    </Sheet>
  )
}
