import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  AuthCard,
  Field,
  inputClass,
  primaryButtonClass,
} from "@/components/auth/AuthCard";
import { authApi, ApiError } from "@/lib/api";

export const Route = createFileRoute("/forgot-password")({
  head: () => ({
    meta: [{ title: "Reset your password — ProfileGPT" }],
  }),
  component: ForgotPasswordPage,
});

function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await authApi.forgotPassword(email.trim());
      setSent(true);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not send the reset email."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Forgot your password?"
      subtitle="Enter your account email and we'll send a secure reset link."
      footer={
        <>
          Remembered it?{" "}
          <Link to="/login" className="text-accent hover:underline">
            Back to sign in
          </Link>
        </>
      }
    >
      {sent ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
          <div className="flex items-center gap-2 text-accent font-medium mb-1">
            <CheckCircle2 className="size-4" />
            Check your inbox
          </div>
          <p className="text-muted-foreground leading-relaxed">
            If an account exists for <span className="text-foreground">{email}</span>,
            a reset link is on its way. The link expires in 10 minutes.
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
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
            Send reset link
          </button>
        </form>
      )}
    </AuthCard>
  );
}
