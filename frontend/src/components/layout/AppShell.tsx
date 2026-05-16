import { Link, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Briefcase,
  Upload,
  Sparkles,
} from "lucide-react";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/dashboard", label: "Intelligence", icon: LayoutDashboard },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/recruiter", label: "Recruiter View", icon: Briefcase },
  { to: "/upload", label: "Upload", icon: Upload },
] as const;

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-panel/40 backdrop-blur-sm">
        <Link to="/" className="flex items-center gap-2 px-5 h-16 border-b border-border">
          <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
            <div className="size-2 bg-background rotate-45" />
          </div>
          <span className="font-semibold tracking-tight">ProfileGPT</span>
        </Link>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => {
            const active = pathname.startsWith(item.to);
            const Icon = item.icon;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-md text-sm transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-muted-foreground hover:text-foreground hover:bg-panel"
                )}
              >
                <Icon className="size-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-border">
          <div className="rounded-lg border border-border bg-panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-3 text-accent" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
                Engine v2.4
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Neural profile active. All data is mocked.
            </p>
          </div>
        </div>
      </aside>
      <main className="flex-1 min-w-0">{children}</main>
    </div>
  );
}
