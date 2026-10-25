import { useState } from "react";
import { Check, Copy, ExternalLink, Loader2, Link2, ShieldOff, X } from "lucide-react";
import type { Sharing } from "@/lib/types";

export function ShareDialog({
  open,
  onClose,
  sharing,
  resumeId,
  onShare,
  onRevoke,
}: {
  open: boolean;
  onClose: () => void;
  sharing: Sharing | null;
  resumeId?: string;
  onShare: (id: string) => Promise<Sharing>;
  onRevoke: (id: string) => Promise<Sharing>;
}) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!open) return null;

  const publish = async () => {
    if (!resumeId) return;
    setBusy(true);
    setError(null);
    try {
      await onShare(resumeId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not share.");
    } finally {
      setBusy(false);
    }
  };

  const revoke = async () => {
    if (!resumeId) return;
    setBusy(true);
    setError(null);
    try {
      await onRevoke(resumeId);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not revoke.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async () => {
    if (!sharing?.url) return;
    try {
      await navigator.clipboard.writeText(sharing.url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1_800);
    } catch {
      setError("Could not copy the link. Select it manually.");
    }
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <button
        aria-label="Close share dialog"
        onClick={onClose}
        className="absolute inset-0 bg-background/80 backdrop-blur-sm"
      />
      <div className="relative w-full max-w-lg rounded-2xl border border-border bg-panel p-6 shadow-2xl">
        <button
          onClick={onClose}
          className="absolute right-4 top-4 size-8 rounded-md border border-border flex items-center justify-center text-muted-foreground hover:text-foreground"
          aria-label="Close"
        >
          <X className="size-4" />
        </button>

        <div className="flex items-center gap-2 text-accent mb-2">
          <Link2 className="size-4" />
          <span className="text-[10px] font-mono uppercase tracking-widest">
            Public profile
          </span>
        </div>
        <h2 className="text-xl font-semibold tracking-tight mb-2">
          Share a read-only profile.
        </h2>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">
          Anyone with the link can view this profile and ask questions through a
          rate-limited AI chat. Your resume file is never exposed.
        </p>

        {sharing?.isPublic && sharing.url ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg border border-accent/30 bg-accent/5 p-2 pl-3">
              <span className="text-xs text-foreground/90 truncate flex-1">
                {sharing.url}
              </span>
              <button
                onClick={() => void copy()}
                className="shrink-0 inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-accent text-accent-foreground text-[11px] font-semibold"
              >
                {copied ? <Check className="size-3" /> : <Copy className="size-3" />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href={sharing.url}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs hover:border-accent/40 transition-colors"
              >
                <ExternalLink className="size-3" />
                Open public profile
              </a>
              <button
                onClick={() => void revoke()}
                disabled={busy}
                className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-red-500/30 text-red-300 text-xs hover:bg-red-500/10 transition-colors disabled:opacity-50"
              >
                {busy ? (
                  <Loader2 className="size-3 animate-spin" />
                ) : (
                  <ShieldOff className="size-3" />
                )}
                Revoke link
              </button>
            </div>
          </div>
        ) : (
          <button
            onClick={() => void publish()}
            disabled={busy || !resumeId}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-accent text-accent-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
          >
            {busy ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Link2 className="size-4" />
            )}
            Create public link
          </button>
        )}

        {error && (
          <p className="mt-4 text-xs text-red-300">{error}</p>
        )}
      </div>
    </div>
  );
}
