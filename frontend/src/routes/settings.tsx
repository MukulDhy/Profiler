import { useEffect, useRef, useState } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import {
  AlertCircle,
  BadgeCheck,
  Camera,
  CheckCircle2,
  Github,
  Loader2,
  Lock,
  Save,
  ShieldAlert,
  Trash2,
  UserRound,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth/AuthCard";
import { useAuth } from "@/lib/auth";
import { ApiError, authApi } from "@/lib/api";
import type { AuthUser } from "@/lib/types";

export const Route = createFileRoute("/settings")({
  head: () => ({
    meta: [
      { title: "Settings — ProfileGPT" },
      {
        name: "description",
        content:
          "Manage your ProfileGPT profile, avatar, password, email verification and GitHub connection.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <SettingsPage />
    </AppShell>
  ),
});

const DEMO_EMAIL = "demo@profilegpt.local";
const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

function errorMessage(caught: unknown, fallback: string): string {
  return caught instanceof ApiError ? caught.message : fallback;
}

function Notice({
  tone = "error",
  children,
}: {
  tone?: "error" | "success";
  children: React.ReactNode;
}) {
  const isError = tone === "error";
  return (
    <div
      className={`flex items-start gap-2 rounded-lg border p-3 text-xs ${
        isError
          ? "border-red-500/30 bg-red-500/10 text-red-300"
          : "border-accent/30 bg-accent/5 text-accent"
      }`}
    >
      {isError ? (
        <AlertCircle className="size-4 shrink-0 mt-0.5" />
      ) : (
        <CheckCircle2 className="size-4 shrink-0 mt-0.5" />
      )}
      <span>{children}</span>
    </div>
  );
}

function SettingsPage() {
  const { user, updateUser, logout } = useAuth();
  const navigate = useNavigate();

  if (!user) return null;
  const isDemo = user.email === DEMO_EMAIL;

  return (
    <div className="p-6 lg:p-10 max-w-4xl mx-auto space-y-8">
      <div>
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
          Account
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-2">Settings</h1>
        <p className="text-muted-foreground max-w-2xl">
          Control how you appear across your profile, public share links and
          recruiter conversations.
        </p>
      </div>

      {isDemo && (
        <Notice tone="success">
          You are signed in to the shared demo account. Changes here are visible
          to everyone using the demo — create your own account for a private
          profile.
        </Notice>
      )}

      <ProfileSection
        user={user}
        isDemo={isDemo}
        onUser={updateUser}
      />
      <SecuritySection user={user} onUser={updateUser} isDemo={isDemo} />
      <DangerSection
        isDemo={isDemo}
        onDeactivated={async () => {
          await logout();
          void navigate({ to: "/" });
        }}
      />
    </div>
  );
}

function ProfileSection({
  user,
  isDemo,
  onUser,
}: {
  user: AuthUser;
  isDemo: boolean;
  onUser: (user: AuthUser) => void;
}) {
  const [form, setForm] = useState({
    name: user.name ?? "",
    username: user.username ?? "",
    location: user.location ?? "",
    phone: user.phone ?? "",
    bio: user.bio ?? "",
    githubUsername: user.githubUsername ?? "",
  });
  const [saving, setSaving] = useState(false);
  const [avatarBusy, setAvatarBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setForm({
      name: user.name ?? "",
      username: user.username ?? "",
      location: user.location ?? "",
      phone: user.phone ?? "",
      bio: user.bio ?? "",
      githubUsername: user.githubUsername ?? "",
    });
  }, [user]);

  const set = (key: keyof typeof form) => (
    event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    setForm((current) => ({ ...current, [key]: event.target.value }));
    setSaved(false);
  };

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const { user: next } = await authApi.updateProfile({
        name: form.name.trim(),
        username: form.username.trim() || null,
        location: form.location.trim() || null,
        phone: form.phone.trim() || null,
        bio: form.bio.trim() || null,
        githubUsername: form.githubUsername.trim() || null,
      } as Partial<AuthUser>);
      onUser(next);
      setSaved(true);
    } catch (caught) {
      setError(errorMessage(caught, "Could not save your profile."));
    } finally {
      setSaving(false);
    }
  };

  const onAvatar = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Choose an image file (PNG, JPG or WebP).");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Avatar must be 5 MB or smaller.");
      return;
    }

    setAvatarBusy(true);
    setError(null);
    try {
      const { user: next } = await authApi.uploadAvatar(file);
      onUser(next);
    } catch (caught) {
      setError(errorMessage(caught, "Could not upload your avatar."));
    } finally {
      setAvatarBusy(false);
    }
  };

  const removeAvatar = async () => {
    setAvatarBusy(true);
    setError(null);
    try {
      const { user: next } = await authApi.removeAvatar();
      onUser(next);
    } catch (caught) {
      setError(errorMessage(caught, "Could not remove your avatar."));
    } finally {
      setAvatarBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-panel p-6">
      <div className="flex items-center gap-2 mb-6">
        <UserRound className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">Profile</h2>
        <span className="ml-auto text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          {user.provider === "google" ? "Google account" : "Email account"}
        </span>
      </div>

      <div className="flex flex-wrap items-center gap-4 mb-6">
        {user.profilePicture ? (
          <img
            src={user.profilePicture}
            alt={user.name}
            className="size-16 rounded-full object-cover border border-border"
          />
        ) : (
          <div className="size-16 rounded-full bg-stone-800 border border-border flex items-center justify-center text-sm font-mono">
            {(user.name || "PG")
              .split(/\s+/)
              .filter(Boolean)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("") || "PG"}
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(event) => void onAvatar(event)}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={avatarBusy}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs hover:border-accent/40 transition-colors disabled:opacity-50"
          >
            {avatarBusy ? (
              <Loader2 className="size-3.5 animate-spin" />
            ) : (
              <Camera className="size-3.5" />
            )}
            Upload photo
          </button>
          {user.profilePicture && (
            <button
              type="button"
              onClick={() => void removeAvatar()}
              disabled={avatarBusy}
              className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs text-muted-foreground hover:text-red-300 hover:border-red-500/30 transition-colors disabled:opacity-50"
            >
              <Trash2 className="size-3.5" />
              Remove
            </button>
          )}
        </div>
      </div>

      <form onSubmit={save}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">
          <Field label="Full name">
            <input
              required
              value={form.name}
              onChange={set("name")}
              className={inputClass}
              autoComplete="name"
            />
          </Field>
          <Field label="Username" hint="Letters, numbers, dots, hyphens, underscores.">
            <input
              value={form.username}
              onChange={set("username")}
              className={inputClass}
              placeholder="ada-lovelace"
              autoComplete="username"
            />
          </Field>
          <Field label="Location">
            <input
              value={form.location}
              onChange={set("location")}
              className={inputClass}
              placeholder="London, UK"
            />
          </Field>
          <Field label="Phone">
            <input
              value={form.phone}
              onChange={set("phone")}
              className={inputClass}
              placeholder="+44 7700 900000"
              autoComplete="tel"
            />
          </Field>
        </div>

        <Field label="Bio" hint="Up to 500 characters. Shown on public profiles.">
          <textarea
            value={form.bio}
            onChange={set("bio")}
            rows={3}
            maxLength={500}
            className={`${inputClass} resize-y`}
            placeholder="A short summary recruiters should see first."
          />
        </Field>

        <Field
          label="GitHub username"
          hint="Powers live repository and commit activity on your dashboard."
        >
          <div className="relative">
            <Github className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
            <input
              value={form.githubUsername}
              onChange={set("githubUsername")}
              className={`${inputClass} pl-9`}
              placeholder="octocat"
            />
          </div>
        </Field>

        <Field label="Email">
          <input
            value={user.email}
            readOnly
            className={`${inputClass} opacity-60 cursor-not-allowed`}
          />
        </Field>

        {error && (
          <div className="mb-4">
            <Notice>{error}</Notice>
          </div>
        )}
        {saved && (
          <div className="mb-4">
            <Notice tone="success">Profile saved.</Notice>
          </div>
        )}

        <button
          type="submit"
          disabled={saving || isDemo}
          className={`${primaryButtonClass} md:w-auto md:px-6`}
        >
          {saving ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <Save className="size-4" />
          )}
          Save profile
        </button>
      </form>
    </section>
  );
}

function SecuritySection({
  user,
  onUser,
  isDemo,
}: {
  user: AuthUser;
  onUser: (user: AuthUser) => void;
  isDemo: boolean;
}) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [otp, setOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [verifyError, setVerifyError] = useState<string | null>(null);
  const [verified, setVerified] = useState(Boolean(user.isEmailVerified));

  useEffect(() => {
    setVerified(Boolean(user.isEmailVerified));
  }, [user.isEmailVerified]);

  const changePassword = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaved(false);

    if (newPassword !== confirm) {
      setError("New passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      const { user: next } = await authApi.changePassword({
        currentPassword,
        newPassword,
      });
      onUser(next);
      setCurrentPassword("");
      setNewPassword("");
      setConfirm("");
      setSaved(true);
    } catch (caught) {
      setError(errorMessage(caught, "Could not change your password."));
    } finally {
      setBusy(false);
    }
  };

  const sendCode = async () => {
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      await authApi.sendVerification();
      setOtpSent(true);
    } catch (caught) {
      setVerifyError(errorMessage(caught, "Could not send a verification code."));
    } finally {
      setVerifyBusy(false);
    }
  };

  const verify = async (event: React.FormEvent) => {
    event.preventDefault();
    setVerifyBusy(true);
    setVerifyError(null);
    try {
      const { user: next } = await authApi.verifyEmail({
        otp: otp.trim(),
        email: user.email,
      });
      onUser(next);
      setVerified(true);
      setOtpSent(false);
      setOtp("");
    } catch (caught) {
      setVerifyError(errorMessage(caught, "Could not verify that code."));
    } finally {
      setVerifyBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-border bg-panel p-6">
      <div className="flex items-center gap-2 mb-6">
        <Lock className="size-4 text-accent" />
        <h2 className="text-sm font-semibold">Security</h2>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Change password
          </h3>
          <form onSubmit={changePassword}>
            <Field label="Current password">
              <input
                type="password"
                required
                value={currentPassword}
                onChange={(event) => setCurrentPassword(event.target.value)}
                className={inputClass}
                autoComplete="current-password"
              />
            </Field>
            <Field
              label="New password"
              hint="8+ chars with upper, lower, number and special character."
            >
              <input
                type="password"
                required
                value={newPassword}
                onChange={(event) => setNewPassword(event.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </Field>
            <Field label="Confirm new password">
              <input
                type="password"
                required
                value={confirm}
                onChange={(event) => setConfirm(event.target.value)}
                className={inputClass}
                autoComplete="new-password"
              />
            </Field>

            {error && (
              <div className="mb-4">
                <Notice>{error}</Notice>
              </div>
            )}
            {saved && (
              <div className="mb-4">
                <Notice tone="success">Password updated.</Notice>
              </div>
            )}

            <button
              type="submit"
              disabled={busy || isDemo}
              className={secondaryButtonClass}
            >
              {busy ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Lock className="size-4" />
              )}
              Update password
            </button>
          </form>
        </div>

        <div>
          <h3 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
            Email verification
          </h3>

          <div
            className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${
              verified
                ? "border-accent/30 bg-accent/5 text-accent"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            <BadgeCheck className="size-4 shrink-0" />
            {verified ? "Your email is verified." : "Your email is not verified yet."}
          </div>

          {!verified && (
            <div className="mt-4 space-y-3">
              <button
                type="button"
                onClick={() => void sendCode()}
                disabled={verifyBusy}
                className={secondaryButtonClass}
              >
                {verifyBusy && !otpSent ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <BadgeCheck className="size-4" />
                )}
                {otpSent ? "Resend code" : "Send verification code"}
              </button>

              {otpSent && (
                <form onSubmit={verify}>
                  <Field
                    label="6-digit code"
                    hint="In development the code is printed in the backend logs."
                  >
                    <input
                      inputMode="numeric"
                      pattern="[0-9]*"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(event) => setOtp(event.target.value)}
                      className={inputClass}
                      placeholder="123456"
                    />
                  </Field>
                  <button
                    type="submit"
                    disabled={verifyBusy}
                    className={primaryButtonClass}
                  >
                    {verifyBusy ? (
                      <Loader2 className="size-4 animate-spin" />
                    ) : (
                      <BadgeCheck className="size-4" />
                    )}
                    Verify email
                  </button>
                </form>
              )}

              {verifyError && <Notice>{verifyError}</Notice>}
            </div>
          )}

          <p className="mt-4 text-[11px] text-muted-foreground leading-relaxed">
            Verification is optional for local development. Set
            <code className="mx-1 font-mono text-accent">REQUIRE_EMAIL_VERIFICATION=true</code>
            on the backend to require it in production.
          </p>
        </div>
      </div>
    </section>
  );
}

function DangerSection({
  isDemo,
  onDeactivated,
}: {
  isDemo: boolean;
  onDeactivated: () => Promise<void>;
}) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const deactivate = async () => {
    setBusy(true);
    setError(null);
    try {
      await authApi.deactivate();
      await onDeactivated();
    } catch (caught) {
      setError(errorMessage(caught, "Could not deactivate your account."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="rounded-xl border border-red-500/25 bg-red-500/[0.03] p-6">
      <div className="flex items-center gap-2 mb-2">
        <ShieldAlert className="size-4 text-red-300" />
        <h2 className="text-sm font-semibold">Danger zone</h2>
      </div>
      <p className="text-sm text-muted-foreground mb-4 max-w-2xl">
        Deactivating signs you out everywhere and blocks future sign-ins. Your
        uploads and notes are retained but cannot be accessed. Contact support to
        restore the account.
      </p>

      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}

      {confirming ? (
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => void deactivate()}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-red-500/90 text-white text-sm font-semibold hover:bg-red-500 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <ShieldAlert className="size-4" />
            )}
            Yes, deactivate my account
          </button>
          <button
            type="button"
            onClick={() => setConfirming(false)}
            disabled={busy}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-border text-sm hover:border-accent/40 disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setConfirming(true)}
          disabled={isDemo}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md border border-red-500/30 text-red-300 text-sm hover:bg-red-500/10 transition-colors disabled:opacity-40"
        >
          <ShieldAlert className="size-4" />
          Deactivate account
        </button>
      )}
    </section>
  );
}
