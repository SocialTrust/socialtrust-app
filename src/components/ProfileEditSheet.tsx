import { useEffect, useState } from 'react'
import type { SocialProfile } from '../types'
import { Sheet } from './Sheet'

type ProfileEditSheetProps = {
  open: boolean
  profile?: SocialProfile
  onClose: () => void
  onSave: (values: {
    displayName: string
    xUsername: string
    telegramUsername: string
    imgUrl: string
  }) => Promise<boolean | void> | void
}

export function ProfileEditSheet({ open, profile, onClose, onSave }: ProfileEditSheetProps) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? '')
  const [xUsername, setXUsername] = useState(profile?.xUsername ?? '')
  const [telegramUsername, setTelegramUsername] = useState(profile?.telegramUsername ?? '')
  const [imgUrl, setImgUrl] = useState(profile?.imgUrl ?? '')

  useEffect(() => {
    if (!open) return
    setDisplayName(profile?.displayName ?? '')
    setXUsername(profile?.xUsername ?? '')
    setTelegramUsername(profile?.telegramUsername ?? '')
    setImgUrl(profile?.imgUrl ?? '')
  }, [open, profile?.displayName, profile?.xUsername, profile?.telegramUsername, profile?.imgUrl])

  return (
    <Sheet
      open={open}
      title="Edit profile"
      description="Update the public details shown on your account and friend rows."
      onClose={onClose}
    >
      <form
        className="profileEditForm"
        onSubmit={async (event) => {
          event.preventDefault()
          await onSave({ displayName, xUsername, telegramUsername, imgUrl })
          onClose()
        }}
      >
        <label>
          <span>Display name</span>
          <input
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Jamie"
            maxLength={64}
          />
        </label>
        <div className="twoFieldGrid">
          <label>
            <span>X username</span>
            <input
              value={xUsername}
              onChange={(event) => setXUsername(event.target.value)}
              placeholder="jamie_judd"
              maxLength={15}
              autoCapitalize="none"
            />
          </label>
          <label>
            <span>Telegram username</span>
            <input
              value={telegramUsername}
              onChange={(event) => setTelegramUsername(event.target.value)}
              placeholder="jamiejudd"
              maxLength={32}
              autoCapitalize="none"
            />
          </label>
        </div>
        <label>
          <span>Profile image URL</span>
          <input
            value={imgUrl}
            onChange={(event) => setImgUrl(event.target.value)}
            placeholder="https://..."
            maxLength={1024}
            autoCapitalize="none"
          />
        </label>
        <p className="finePrint">
          Usernames are saved without @. Image URL must start with https://.
          Leave image URL blank to use the default avatar.
        </p>
        <div className="buttonGrid">
          <button className="secondaryButton" type="button" onClick={onClose}>Cancel</button>
          <button className="primaryButton" type="submit">Save profile</button>
        </div>
      </form>
    </Sheet>
  )
}
