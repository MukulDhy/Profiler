import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import {
  AuthCard,
  Field,
  inputClass,
  primaryButtonClass,
} from "@/components/auth/AuthCard";
import { authApi, ApiError } from "@/lib/api";

export const Route = createFileRoute("/reset-password/$token")({
  head: () => ({
    meta: [{ title: "Choose a new password — ProfileGPT" }],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { token } = Route.useParams();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }

    setBusy(true);
    try {
      await authApi.resetPassword(token, password);
      setDone(true);
      window.setTimeout(() => {
        void navigate({ to: "/dashboard", replace: true });
      }, 1_200);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not reset your password."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthCard
      title="Choose a new password."
      subtitle="Your reset link is single-use and expires after 10 minutes."
      footer={
        <Link to="/login" className="text-accent hover:underline">
          Back to sign in
        </Link>
      }
    >
      {done ? (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-4 text-sm">
          <div className="flex items-center gap-2 text-accent font-medium mb-1">
            <CheckCircle2 className="size-4" />
            Password updated
          </div>
          <p className="text-muted-foreground">
            You're signed in. Taking you to your dashboard…
          </p>
        </div>
      ) : (
        <form onSubmit={onSubmit}>
          <Field
            label="New password"
            hint="8+ characters with upper, lower, number and special character."
          >
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className={inputClass}
              autoComplete="new-password"
              placeholder="New password"
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
              placeholder="Repeat new password"
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
            Update password
          </button>
        </form>
      )}
    </AuthCard>
  );
}
