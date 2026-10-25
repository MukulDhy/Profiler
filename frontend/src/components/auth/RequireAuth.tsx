import { useEffect, type ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export function RequireAuth({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && !user) {
      void navigate({ to: "/login", replace: true });
    }
  }, [loading, user, navigate]);

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-background text-foreground">
        <Loader2 className="size-6 text-accent animate-spin" />
        <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
          Restoring session
        </p>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background px-6">
        <p className="text-sm text-muted-foreground">
          Redirecting to sign in…
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
