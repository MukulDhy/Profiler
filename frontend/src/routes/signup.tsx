import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Check, Loader2 } from "lucide-react";
import {
  AuthCard,
  Field,
  inputClass,
  primaryButtonClass,
} from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/signup")({
  head: () => ({
    meta: [
      { title: "Create your account — ProfileGPT" },
      {
        name: "description",
        content: "Create a free ProfileGPT account and make your resume queryable.",
      },
    ],
  }),
  component: SignupPage,
});

const rules = [
  { label: "8+ characters", test: (value: string) => value.length >= 8 },
  { label: "Uppercase letter", test: (value: string) => /[A-Z]/.test(value) },
  { label: "Lowercase letter", test: (value: string) => /[a-z]/.test(value) },
  { label: "Number", test: (value: string) => /\d/.test(value) },
  { label: "Special character", test: (value: string) => /[@$!%*?&]/.test(value) },
];

function SignupPage() {
  const { user, config, loading, register, loginWithGoogle } = useAuth();
  const navigate = useNavigate();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (!rules.every((rule) => rule.test(password))) {
      setError("Your password does not meet all requirements yet.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await register(name.trim(), email.trim(), password);
      void navigate({ to: "/dashboard", replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not create your account. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const onGoogle = async (credential: string) => {
    setError(null);
    setBusy(true);
    try {
      await loginWithGoogle(credential);
      void navigate({ to: "/dashboard", replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Google sign-in failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Make your resume talk."
      subtitle="Create a free account. No credit card, no trial, no limits on the core experience."
      footer={
        <>
          Already have an account?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Sign in
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <Field label="Full name">
          <input
            required
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            placeholder="Ada Lovelace"
            autoComplete="name"
          />
        </Field>

        <Field label="Email">
          <input
            type="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="you@example.com"
            autoComplete="email"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            placeholder="Create a strong password"
            autoComplete="new-password"
          />
        </Field>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 mb-4">
          {rules.map((rule) => {
            const passed = rule.test(password);
            return (
              <div
                key={rule.label}
                className={`flex items-center gap-1.5 text-[11px] ${
                  passed ? "text-accent" : "text-muted-foreground"
                }`}
              >
                <Check
                  className={`size-3 ${passed ? "opacity-100" : "opacity-30"}`}
                />
                {rule.label}
              </div>
            );
          })}
        </div>

        <Field label="Confirm password">
          <input
            type="password"
            required
            value={confirm}
            onChange={(event) => setConfirm(event.target.value)}
            className={inputClass}
            placeholder="Repeat your password"
            autoComplete="new-password"
          />
        </Field>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          Create free account
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <GoogleButton
        enabled={Boolean(config?.googleEnabled)}
        onCredential={(credential) => void onGoogle(credential)}
        label="Sign up with Google"
      />

      <p className="mt-6 text-[11px] leading-relaxed text-muted-foreground">
        By creating an account you agree to keep the content you upload truthful.
        ProfileGPT is free; you control whether your profile is public and can
        revoke a share link at any time.
      </p>
    </AuthCard>
  );
}
