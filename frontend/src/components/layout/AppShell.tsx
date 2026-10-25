import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import type { ReactNode } from "react";
import {
  LayoutDashboard,
  MessageSquare,
  FolderKanban,
  Briefcase,
  Upload,
  Sparkles,
  FileStack,
  Settings,
  LogOut,
  Menu,
} from "lucide-react";
import { useLayoutEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";
import { useAuth } from "@/lib/auth";
import { RequireAuth } from "@/components/auth/RequireAuth";

const nav = [
  { to: "/dashboard", label: "Intelligence", icon: LayoutDashboard },
  { to: "/chat", label: "AI Chat", icon: MessageSquare },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/recruiter", label: "Recruiter View", icon: Briefcase },
  { to: "/resumes", label: "Resumes", icon: FileStack },
  { to: "/upload", label: "Upload", icon: Upload },
] as const;

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function Avatar({ name, src }: { name: string; src?: string | null }) {
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        className="size-9 rounded-full object-cover border border-border"
      />
    );
  }
  return (
    <div className="size-9 rounded-full bg-stone-800 border border-border flex items-center justify-center text-[10px] font-mono">
      {initials(name) || "PG"}
    </div>
  );
}

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <RequireAuth>
      <AppShellInner>{children}</AppShellInner>
    </RequireAuth>
  );
}

function AppShellInner({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const mainRef = useRef<HTMLElement | null>(null);
  const scrollPositions = useRef<Record<string, number>>({});

  // <main> is the scroll container, so remember its position per route and
  // restore it when navigating (including browser back/forward). Layout effects
  // run before paint so a route swap cannot clamp the saved offset first.
  useLayoutEffect(() => {
    const element = mainRef.current;
    if (!element) return;

    const handleScroll = () => {
      scrollPositions.current[pathname] = element.scrollTop;
    };

    element.addEventListener("scroll", handleScroll, { passive: true });
    return () => element.removeEventListener("scroll", handleScroll);
  }, [pathname]);

  useLayoutEffect(() => {
    mainRef.current?.scrollTo({
      top: scrollPositions.current[pathname] ?? 0,
      left: 0,
    });
  }, [pathname]);

  const onLogout = async () => {
    await logout();
    void navigate({ to: "/" });
  };

  return (
    <div className="h-dvh flex overflow-hidden bg-background text-foreground">
      <aside className="hidden md:flex w-60 shrink-0 flex-col border-r border-border bg-panel/40 backdrop-blur-sm">
        <Link
          to="/"
          className="flex items-center gap-2 px-5 h-16 border-b border-border"
        >
          <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
            <div className="size-2 bg-background rotate-45" />
          </div>
          <span className="font-semibold tracking-tight">ProfileGPT</span>
        </Link>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
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

        <div className="p-3 border-t border-border space-y-2">
          <div className="rounded-lg border border-border bg-panel p-3">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="size-3 text-accent" />
              <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
                Free forever
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              Neural profile active. Upload a resume to analyse it live.
            </p>
          </div>

          <Link
            to="/settings"
            className={cn(
              "flex items-center gap-3 px-2 py-2 rounded-md text-sm transition-colors",
              pathname.startsWith("/settings")
                ? "bg-accent-soft text-accent"
                : "text-muted-foreground hover:text-foreground hover:bg-panel"
            )}
          >
            <Avatar name={user?.name ?? "Profile"} src={user?.profilePicture} />
            <div className="min-w-0 flex-1">
              <div className="truncate text-xs font-medium text-foreground">
                {user?.name ?? "Profile"}
              </div>
              <div className="truncate text-[10px] text-muted-foreground">
                {user?.email}
              </div>
            </div>
            <Settings className="size-4 shrink-0" />
          </Link>
          <button
            onClick={() => void onLogout()}
            className="w-full flex items-center gap-3 px-3 py-2 rounded-md text-xs text-muted-foreground hover:text-foreground hover:bg-panel transition-colors"
          >
            <LogOut className="size-4" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="flex-1 min-w-0 flex flex-col h-full overflow-hidden">
        {/* Mobile top bar */}
        <header className="md:hidden shrink-0 z-40 border-b border-border bg-background/85 backdrop-blur-md">
          <div className="h-14 px-4 flex items-center justify-between">
            <Link to="/dashboard" className="flex items-center gap-2">
              <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
                <div className="size-2 bg-background rotate-45" />
              </div>
              <span className="font-semibold tracking-tight">ProfileGPT</span>
            </Link>
            <button
              onClick={() => setMobileOpen((open) => !open)}
              className="size-9 rounded-md border border-border flex items-center justify-center"
              aria-label="Toggle navigation"
            >
              <Menu className="size-4" />
            </button>
          </div>
          {mobileOpen && (
            <div className="border-t border-border p-3 grid grid-cols-2 gap-2">
              {nav.map((item) => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.to}
                    to={item.to}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "flex items-center gap-2 px-3 py-2 rounded-md text-sm",
                      pathname.startsWith(item.to)
                        ? "bg-accent-soft text-accent"
                        : "bg-panel text-muted-foreground"
                    )}
                  >
                    <Icon className="size-4" />
                    {item.label}
                  </Link>
                );
              })}
              <Link
                to="/settings"
                onClick={() => setMobileOpen(false)}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-panel text-muted-foreground"
              >
                <Settings className="size-4" />
                Settings
              </Link>
              <button
                onClick={() => void onLogout()}
                className="flex items-center gap-2 px-3 py-2 rounded-md text-sm bg-panel text-muted-foreground"
              >
                <LogOut className="size-4" />
                Sign out
              </button>
            </div>
          )}
        </header>

        <main
          ref={mainRef}
          className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
