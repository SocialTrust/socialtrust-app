import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { SocialProfile } from '../types'
import { Sheet } from './Sheet'

export type ProfileFormValues = Pick<SocialProfile, 'displayName' | 'xUsername' | 'telegramUsername' | 'discordUsername' | 'imgUrl'>

type ProfileEditSheetProps = {
  open: boolean
  loadProfile: () => Promise<SocialProfile>
  onClose: () => void
  onSave: (values: ProfileFormValues) => Promise<boolean | void> | boolean | void
}

function formValues(profile: SocialProfile): ProfileFormValues {
  return {
    displayName: profile.displayName,
    xUsername: profile.xUsername,
    telegramUsername: profile.telegramUsername,
    discordUsername: profile.discordUsername,
    imgUrl: profile.imgUrl,
  }
}

export function ProfileEditSheet({ open, loadProfile, onClose, onSave }: ProfileEditSheetProps) {
  const [original, setOriginal] = useState<ProfileFormValues>()
  const [values, setValues] = useState<ProfileFormValues>()
  const [loading, setLoading] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const loadProfileRef = useRef(loadProfile)
  const submittingRef = useRef(false)
  loadProfileRef.current = loadProfile

  const load = useCallback(async () => {
    setLoading(true)
    setLoadError(false)
    setOriginal(undefined)
    setValues(undefined)
    try {
      const next = formValues(await loadProfileRef.current())
      setOriginal(next)
      setValues(next)
    } catch {
      setLoadError(true)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) void load()
  }, [open, load])

  const dirty = useMemo(() => Boolean(original && values && Object.keys(original).some(
    (key) => original[key as keyof ProfileFormValues] !== values[key as keyof ProfileFormValues],
  )), [original, values])

  const close = () => {
    if (!submittingRef.current) onClose()
  }

  const update = (field: keyof ProfileFormValues, value: string) => {
    setValues((current) => current ? { ...current, [field]: value } : current)
  }

  return (
    <Sheet
      open={open}
      title="Edit profile"
      description="Update the public details shown on your account and friend rows."
      onClose={close}
    >
      {loading ? <p>loading profile...</p> : null}
      {loadError ? (
        <div className="emptyState errorBox">
          <p>Could not load your profile. Try again.</p>
          <button className="secondaryButton" type="button" onClick={() => void load()}>Retry</button>
        </div>
      ) : null}
      {values && !loading ? (
        <form
          className="profileEditForm"
          onSubmit={async (event) => {
            event.preventDefault()
            if (submittingRef.current || !dirty) return
            submittingRef.current = true
            setSubmitting(true)
            try {
              const success = await onSave(values)
              if (success) onClose()
            } finally {
              submittingRef.current = false
              setSubmitting(false)
            }
          }}
        >
          <label>
            <span>Display name</span>
            <input value={values.displayName} onChange={(event) => update('displayName', event.target.value)} maxLength={64} />
          </label>
          <div className="twoFieldGrid">
            <label>
              <span>X username</span>
              <input value={values.xUsername} onChange={(event) => update('xUsername', event.target.value)} maxLength={15} autoCapitalize="none" />
            </label>
            <label>
              <span>Telegram username</span>
              <input value={values.telegramUsername} onChange={(event) => update('telegramUsername', event.target.value)} maxLength={32} autoCapitalize="none" />
            </label>
          </div>
          <label>
            <span>Profile image URL</span>
            <input value={values.imgUrl} onChange={(event) => update('imgUrl', event.target.value)} maxLength={1024} autoCapitalize="none" />
          </label>
          <p className="finePrint">Usernames are saved without @. Image URL must start with https://. Leave image URL blank to use the default avatar.</p>
          <div className="buttonGrid">
            <button className="secondaryButton" type="button" disabled={submitting} onClick={close}>Cancel</button>
            <button className="primaryButton" type="submit" disabled={submitting || !dirty}>{submitting ? 'Saving…' : 'Save profile'}</button>
          </div>
        </form>
      ) : null}
    </Sheet>
  )
}
