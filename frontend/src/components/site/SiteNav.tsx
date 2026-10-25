import { Link } from "@tanstack/react-router";
import { useAuth } from "@/lib/auth";

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

export function SiteNav() {
  const { user, loading } = useAuth();

  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
        <Link to="/" className="flex items-center gap-2 shrink-0">
          <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
            <div className="size-2 bg-background rotate-45" />
          </div>
          <span className="font-semibold tracking-tight text-lg">ProfileGPT</span>
        </Link>

        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="/#features" className="hover:text-foreground transition-colors">
            Features
          </a>
          <a href="/#how" className="hover:text-foreground transition-colors">
            How it works
          </a>
          <a href="/#free" className="hover:text-foreground transition-colors">
            Free forever
          </a>

          {!loading && user ? (
            <>
              <Link
                to="/dashboard"
                className="hover:text-foreground transition-colors"
              >
                Dashboard
              </Link>
              <Link
                to="/settings"
                className="flex items-center gap-2 pl-1 pr-2 py-1 rounded-full border border-border hover:border-accent/40 transition-colors"
              >
                {user.profilePicture ? (
                  <img
                    src={user.profilePicture}
                    alt={user.name}
                    className="size-7 rounded-full object-cover"
                  />
                ) : (
                  <span className="size-7 rounded-full bg-stone-800 flex items-center justify-center text-[10px] font-mono text-foreground">
                    {initials(user.name)}
                  </span>
                )}
                <span className="text-xs text-foreground max-w-24 truncate">
                  {user.name.split(" ")[0]}
                </span>
              </Link>
            </>
          ) : (
            <>
              <Link to="/login" className="hover:text-foreground transition-colors">
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-4 py-1.5 bg-accent text-accent-foreground rounded-full hover:brightness-110 transition-all"
              >
                Get Started
              </Link>
            </>
          )}
        </div>

        <div className="md:hidden flex items-center gap-2">
          {!loading && user ? (
            <Link
              to="/dashboard"
              className="px-3 py-1.5 text-xs bg-accent text-accent-foreground rounded-full font-semibold"
            >
              Dashboard
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="px-3 py-1.5 text-xs border border-border rounded-full"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="px-3 py-1.5 text-xs bg-accent text-accent-foreground rounded-full font-semibold"
              >
                Start
              </Link>
            </>
          )}
        </div>
      </div>
    </nav>
  );
}
