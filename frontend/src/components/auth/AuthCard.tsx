import { Link } from "@tanstack/react-router";
import type { ReactNode } from "react";

export function AuthCard({
  title,
  subtitle,
  children,
  footer,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 left-1/2 -translate-x-1/2 size-[32rem] bg-accent/10 rounded-full blur-3xl" />
      </div>

      <header className="relative z-10 px-6 h-16 flex items-center">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
            <div className="size-2 bg-background rotate-45" />
          </div>
          <span className="font-semibold tracking-tight text-lg">ProfileGPT</span>
        </Link>
      </header>

      <main className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-border bg-panel/80 backdrop-blur-md p-8 shadow-2xl">
            <div className="mb-7">
              <h1 className="text-2xl font-semibold tracking-tight mb-2">
                {title}
              </h1>
              {subtitle && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {subtitle}
                </p>
              )}
            </div>
            {children}
          </div>
          {footer && (
            <div className="mt-5 text-center text-sm text-muted-foreground">
              {footer}
            </div>
          )}
        </div>
      </main>

      <footer className="relative z-10 px-6 py-6 text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        Free forever · Your resume can finally talk
      </footer>
    </div>
  );
}

export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  return (
    <label className="block mb-4">
      <span className="block text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {label}
      </span>
      {children}
      {hint && (
        <span className="block text-[11px] text-muted-foreground mt-1.5">
          {hint}
        </span>
      )}
    </label>
  );
}

export const inputClass =
  "w-full bg-background border border-border rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors placeholder:text-muted-foreground/60";

export const primaryButtonClass =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-accent text-accent-foreground rounded-lg text-sm font-semibold hover:brightness-110 transition-all disabled:opacity-50 disabled:cursor-not-allowed";

export const secondaryButtonClass =
  "w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 border border-border rounded-lg text-sm font-medium hover:border-accent/40 transition-colors disabled:opacity-50";
