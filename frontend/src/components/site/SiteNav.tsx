import { Link } from "@tanstack/react-router";

export function SiteNav() {
  return (
    <nav className="fixed top-0 inset-x-0 z-50 border-b border-border bg-background/70 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-2">
          <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
            <div className="size-2 bg-background rotate-45" />
          </div>
          <span className="font-semibold tracking-tight text-lg">ProfileGPT</span>
        </Link>
        <div className="hidden md:flex items-center gap-8 text-sm font-medium text-muted-foreground">
          <a href="#features" className="hover:text-foreground transition-colors">Features</a>
          <a href="#how" className="hover:text-foreground transition-colors">How it works</a>
          <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          <Link to="/dashboard" className="hover:text-foreground transition-colors">Demo</Link>
          <Link
            to="/upload"
            className="px-4 py-1.5 bg-accent text-accent-foreground rounded-full hover:brightness-110 transition-all"
          >
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
