import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, Loader2, Sparkles } from "lucide-react";
import {
  AuthCard,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth/AuthCard";
import { GoogleButton } from "@/components/auth/GoogleButton";
import { useAuth } from "@/lib/auth";
import { ApiError } from "@/lib/api";

export const Route = createFileRoute("/login")({
  head: () => ({
    meta: [
      { title: "Sign in — ProfileGPT" },
      {
        name: "description",
        content: "Sign in to your ProfileGPT account.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const { user, config, loading, login, loginWithDemo, loginWithGoogle } =
    useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      void navigate({ to: "/dashboard", replace: true });
    }
  }, [loading, user, navigate]);

  const finish = () => {
    void navigate({ to: "/dashboard", replace: true });
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await login(email.trim(), password);
      finish();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not sign in. Please try again."
      );
    } finally {
      setBusy(false);
    }
  };

  const onDemo = async () => {
    setError(null);
    setBusy(true);
    try {
      await loginWithDemo();
      finish();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The demo account is unavailable."
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
      finish();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Google sign-in failed."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Welcome back."
      subtitle="Sign in to open your intelligence profile and recruiter chat."
      footer={
        <>
          New here?{" "}
          <Link to="/signup" className="text-accent hover:underline">
            Create an account
          </Link>
        </>
      }
    >
      <form onSubmit={onSubmit}>
        <Field label="Email">
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className={inputClass}
            placeholder="you@example.com"
          />
        </Field>

        <Field label="Password">
          <input
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className={inputClass}
            placeholder="••••••••"
          />
        </Field>

        <div className="flex justify-end mb-5">
          <Link
            to="/forgot-password"
            className="text-xs text-muted-foreground hover:text-accent transition-colors"
          >
            Forgot password?
          </Link>
        </div>

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
          Sign in
        </button>
      </form>

      <div className="my-6 flex items-center gap-3">
        <div className="h-px flex-1 bg-border" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          or
        </span>
        <div className="h-px flex-1 bg-border" />
      </div>

      <div className="space-y-3">
        <GoogleButton
          enabled={Boolean(config?.googleEnabled)}
          onCredential={(credential) => void onGoogle(credential)}
        />

        {config?.demoEnabled && (
          <button
            type="button"
            onClick={() => void onDemo()}
            disabled={busy}
            className={secondaryButtonClass}
          >
            <Sparkles className="size-4 text-accent" />
            Explore the demo profile
          </button>
        )}
      </div>
    </AuthCard>
  );
}
