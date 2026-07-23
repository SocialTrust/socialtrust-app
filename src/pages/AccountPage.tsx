import { useCallback, useEffect, useMemo, useState } from "react";
import type { Address } from "viem";
import { Copy, Pencil } from "lucide-react";
import type {
  AccountProfile,
  ChallengeView,
  ContractConfig,
  SocialProfile,
} from "../types";
import { copyText, formatUsdc, sameAddress, shortAddress } from "../lib/format";
import { getChallengeState } from "../lib/challenges";
import { ProfileAvatar, displayNameFor } from "../components/ProfileAvatar";
import { Sheet } from "../components/Sheet";

type AccountPageProps = {
  address?: Address;
  connectedAccount?: Address;
  isConnected: boolean;
  config?: ContractConfig;
  readAccountProfile: (address: Address) => Promise<AccountProfile>;
  onConnect: () => void;
  onBackHome: () => void;
  onStartWith: (address?: string) => void;
  onOpenChallenge: (challenge: ChallengeView) => void;
  onOpenWallet: () => void;
  onOpenAdmin: () => void;
  onSetProfile: (values: {
    displayName: string;
    xUsername: string;
    telegramUsername: string;
    imgUrl: string;
  }) => Promise<boolean | void> | void;
  onNavigate: (path: string) => void;
  nowSeconds: number;
};

function socialHandle(value?: string) {
  const clean = value?.trim();
  return clean ? `@${clean}` : "Not set";
}

function AccountIdentity({
  address,
  profile,
  socialProfile,
  isSelf,
}: {
  address: Address;
  profile?: AccountProfile;
  socialProfile?: SocialProfile;
  isSelf: boolean;
}) {
  const hasDisplayName = Boolean(socialProfile?.displayName?.trim());
  const primaryName = hasDisplayName
    ? socialProfile?.displayName?.trim()
    : isSelf
      ? "My account"
      : undefined;

  return (
    <section className="accountIdentityBlock accountIdentityClean">
      <ProfileAvatar address={address} profile={socialProfile} size="lg" />
      {primaryName ? <h1 className="heroDisplayName">{primaryName}</h1> : null}
      <div className="heroAddressLine" aria-label="Account address">
        <span className="heroAddressText">{shortAddress(address, 6)}</span>
        <button
          className="copyIconButton"
          onClick={() => copyText(address)}
          aria-label="Copy address"
          title="Copy address"
        >
          <Copy size={15} />
        </button>
      </div>
      <div className={`heroStats ${isSelf ? "two" : "one"}`}>
        {isSelf ? (
          <div>
            <span>Balance</span>
            <strong>{formatUsdc(profile?.appBalance)} USDC</strong>
          </div>
        ) : null}
        <div>
          <span>Reputation</span>
          <strong>{String(profile?.repScore ?? 0n)}</strong>
        </div>
      </div>
    </section>
  );
}

function profileValue(value?: string, formatter?: (value: string) => string) {
  const clean = value?.trim();
  if (!clean) return "Not set";
  return formatter ? formatter(clean) : clean;
}

function ProfileSection({
  profile,
  onEdit,
}: {
  profile?: SocialProfile;
  onEdit: () => void;
}) {
  return (
    <section className="accountSection profileDetailsCard">
      <div className="profileSectionHeader">
        <span className="eyebrow">Profile</span>
        <button className="profileEditLink" onClick={onEdit}>
          <Pencil size={14} /> Edit
        </button>
      </div>
      <div className="profileRows">
        <div className="profileDetailRow">
          <span>Display name</span>
          <strong>{profileValue(profile?.displayName)}</strong>
        </div>
        <div className="profileDetailRow">
          <span>X</span>
          <strong>
            {profileValue(profile?.xUsername, (value) => `@${value}`)}
          </strong>
        </div>
        <div className="profileDetailRow">
          <span>Telegram</span>
          <strong>
            {profileValue(profile?.telegramUsername, (value) => `@${value}`)}
          </strong>
        </div>
      </div>
      {!profile?.exists ? (
        <p className="finePrint profileHint">
          Set a display name so friends can recognise you more easily.
        </p>
      ) : null}
    </section>
  );
}

function ProfileEditSheet({
  open,
  profile,
  onClose,
  onSave,
}: {
  open: boolean;
  profile?: SocialProfile;
  onClose: () => void;
  onSave: (values: {
    displayName: string;
    xUsername: string;
    telegramUsername: string;
    imgUrl: string;
  }) => Promise<boolean | void> | void;
}) {
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [xUsername, setXUsername] = useState(profile?.xUsername ?? "");
  const [telegramUsername, setTelegramUsername] = useState(
    profile?.telegramUsername ?? "",
  );
  const [imgUrl, setImgUrl] = useState(profile?.imgUrl ?? "");

  useEffect(() => {
    if (!open) return;
    setDisplayName(profile?.displayName ?? "");
    setXUsername(profile?.xUsername ?? "");
    setTelegramUsername(profile?.telegramUsername ?? "");
    setImgUrl(profile?.imgUrl ?? "");
  }, [
    open,
    profile?.displayName,
    profile?.xUsername,
    profile?.telegramUsername,
    profile?.imgUrl,
  ]);

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
          event.preventDefault();
          await onSave({ displayName, xUsername, telegramUsername, imgUrl });
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
          <button className="secondaryButton" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primaryButton" type="submit">
            Save profile
          </button>
        </div>
      </form>
    </Sheet>
  );
}

function SocialLinksCard({ profile }: { profile?: SocialProfile }) {
  return (
    <section className="accountSection socialLinksCard">
      <div className="sectionHeader compactHeader">
        <div>
          <span className="eyebrow">Socials</span>
          <h2>Public handles</h2>
        </div>
      </div>
      <div className="accountRows">
        <div>
          <span>X</span>
          <strong>{socialHandle(profile?.xUsername)}</strong>
        </div>
        <div>
          <span>Telegram</span>
          <strong>{socialHandle(profile?.telegramUsername)}</strong>
        </div>
      </div>
    </section>
  );
}

function FriendsPreview({
  friends,
  friendProfiles,
  friendRepScores,
  onNavigate,
}: {
  friends: Address[];
  friendProfiles?: Record<string, SocialProfile>;
  friendRepScores?: Record<string, bigint>;
  onNavigate: (path: string) => void;
}) {
  return (
    <section className="accountSection friendsSectionClean">
      <div className="profileSectionHeader">
        <span className="eyebrow">Friends</span>
      </div>
      <div className="friendCardList">
        {friends.slice(0, 8).map((friend) => {
          const friendProfile = friendProfiles?.[friend.toLowerCase()];
          const friendRep = friendRepScores?.[friend.toLowerCase()] ?? 0n;
          return (
            <button
              className="friendRowCard friendRowTwoLine"
              key={friend}
              onClick={() => onNavigate(`/account/${friend}`)}
              aria-label={`Open ${displayNameFor(friend, friendProfile)}`}
            >
              <ProfileAvatar
                address={friend}
                profile={friendProfile}
                size="sm"
              />
              <span>
                <strong>{displayNameFor(friend, friendProfile)}</strong>
                <small>Reputation {String(friendRep)}</small>
              </span>
            </button>
          );
        })}
        {friends.length === 0 ? (
          <p className="emptyText">No finalized friendships yet.</p>
        ) : null}
      </div>
    </section>
  );
}

export function AccountPage({
  address,
  connectedAccount,
  isConnected,
  config,
  readAccountProfile,
  onConnect,
  onBackHome,
  onStartWith,
  onOpenChallenge,
  onOpenWallet,
  onOpenAdmin,
  onSetProfile,
  onNavigate,
  nowSeconds,
}: AccountPageProps) {
  const [profile, setProfile] = useState<AccountProfile | undefined>();
  const [error, setError] = useState<string | undefined>();
  const [loading, setLoading] = useState(false);
  const [profileEditOpen, setProfileEditOpen] = useState(false);

  const isSelf = Boolean(
    address && connectedAccount && sameAddress(address, connectedAccount),
  );
  const canAdmin = Boolean(
    connectedAccount &&
    config?.owner &&
    sameAddress(connectedAccount, config.owner),
  );

  const loadAccount = useCallback(async () => {
    if (!address) return;
    setLoading(true);
    setError(undefined);
    try {
      const next = await readAccountProfile(address);
      setProfile(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load account.");
    } finally {
      setLoading(false);
    }
  }, [address, readAccountProfile]);

  useEffect(() => {
    let cancelled = false;
    async function run() {
      if (!address) return;
      setLoading(true);
      setError(undefined);
      try {
        const next = await readAccountProfile(address);
        if (!cancelled) setProfile(next);
      } catch (err) {
        if (!cancelled)
          setError(
            err instanceof Error ? err.message : "Could not load account.",
          );
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    run();
    return () => {
      cancelled = true;
    };
  }, [address, readAccountProfile]);

  const liveCounts = useMemo(() => {
    const counts = { attention: 0, active: 0, waiting: 0 };
    for (const challenge of profile?.challenges ?? []) {
      const state = getChallengeState(challenge, nowSeconds);
      if (state === "active-safe" || state === "steal-open") counts.active += 1;
      if (state === "pending-outgoing") counts.waiting += 1;
      if (
        state === "pending-incoming" ||
        state === "ready-finalize" ||
        state === "steal-open" ||
        state === "pending-outgoing"
      )
        counts.attention += 1;
    }
    return counts;
  }, [profile?.challenges, nowSeconds]);

  if (!address) {
    return (
      <div className="emptyState pageEmpty">
        <h1>Connect to view your account</h1>
        <p>The /me route resolves to your connected wallet.</p>
        <button className="primaryButton" onClick={onConnect}>
          Connect wallet
        </button>
      </div>
    );
  }

  return (
    <div className="accountLayout">
      {loading ? (
        <div className="emptyState calm">
          <h3>Loading account…</h3>
        </div>
      ) : null}
      {error ? (
        <div className="emptyState errorBox">
          <h3>Could not load account</h3>
          <p>{error}</p>
        </div>
      ) : null}

      <AccountIdentity
        address={address}
        profile={profile}
        socialProfile={profile?.socialProfile}
        isSelf={isSelf}
      />

      {profile ? (
        <>
          {!isConnected ? (
            <section className="connectPromptBlock">
              <p>
                Connect to start a friendship with this account or respond to an invite.
              </p>
              <button className="primaryButton" onClick={onConnect}>
                Connect wallet
              </button>
            </section>
          ) : null}

          {isSelf ? (
            <>
              <ProfileSection
                profile={profile.socialProfile}
                onEdit={() => setProfileEditOpen(true)}
              />

              <ProfileEditSheet
                open={profileEditOpen}
                profile={profile.socialProfile}
                onClose={() => setProfileEditOpen(false)}
                onSave={async (values) => {
                  await onSetProfile(values);
                  setProfileEditOpen(false);
                  window.setTimeout(() => {
                    void loadAccount();
                  }, 250);
                }}
              />
            </>
          ) : isConnected ? (
            <>
              {profile.socialProfile?.exists ? (
                <SocialLinksCard profile={profile.socialProfile} />
              ) : null}
            </>
          ) : null}

          <FriendsPreview
            friends={profile.friends}
            friendProfiles={profile.friendProfiles}
            friendRepScores={profile.friendRepScores}
            onNavigate={onNavigate}
          />

          {isSelf && canAdmin ? (
            <section className="accountSection adminPrompt">
              <div>
                <span className="eyebrow">Owner</span>
                <h2>Admin controls</h2>
                <p>
                  Manage challenge settings, bonus settings, and reputation
                  scores.
                </p>
              </div>
              <button className="primaryButton" onClick={onOpenAdmin}>
                Open admin
              </button>
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  );
}
