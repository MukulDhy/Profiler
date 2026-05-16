import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useState } from "react";
import { ArrowLeft, Eye, EyeOff, Loader2, Lock, Mail, Sparkles, User } from "lucide-react";

export const Route = createFileRoute("/auth")({
  validateSearch: (search: Record<string, unknown>) => ({
    tab: (search.tab as "login" | "signup") ?? "login",
  }),
  head: () => ({
    meta: [
      { title: "Auth — ProfileGPT" },
      { name: "description", content: "Sign in or create your ProfileGPT account." },
    ],
  }),
  component: AuthPage,
});

// ─── tiny helpers ───────────────────────────────────────────────────────────

function InputField({
  id,
  label,
  type = "text",
  placeholder,
  icon: Icon,
  value,
  onChange,
  showToggle = false,
}: {
  id: string;
  label: string;
  type?: string;
  placeholder: string;
  icon: React.ElementType;
  value: string;
  onChange: (v: string) => void;
  showToggle?: boolean;
}) {
  const [visible, setVisible] = useState(false);
  const inputType = showToggle ? (visible ? "text" : "password") : type;

  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[11px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </label>
      <div className="relative group">
        <Icon className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground group-focus-within:text-accent transition-colors" />
        <input
          id={id}
          type={inputType}
          placeholder={placeholder}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-white/[0.03] border border-border focus:border-accent/60 rounded-lg pl-10 pr-10 py-3 text-sm outline-none transition-all placeholder:text-muted-foreground/40 focus:ring-1 focus:ring-accent/20"
        />
        {showToggle && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-accent transition-colors"
          >
            {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        )}
      </div>
    </div>
  );
}

// ─── login form ──────────────────────────────────────────────────────────────

function LoginForm({ onSwitch }: { onSwitch: () => void }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
  };

  return (
    <motion.form
      key="login"
      initial={{ opacity: 0, x: -24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      <InputField
        id="login-email"
        label="Email"
        type="email"
        placeholder="you@company.com"
        icon={Mail}
        value={email}
        onChange={setEmail}
      />
      <InputField
        id="login-password"
        label="Password"
        placeholder="••••••••"
        icon={Lock}
        value={password}
        onChange={setPassword}
        showToggle
      />

      <div className="flex justify-end">
        <button type="button" className="text-[11px] font-mono text-accent hover:brightness-125 transition-all tracking-wider">
          Forgot password?
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-accent text-accent-foreground font-semibold rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Sign In"
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Don't have an account?{" "}
        <button type="button" onClick={onSwitch} className="text-accent hover:brightness-125 transition font-medium">
          Create one
        </button>
      </p>
    </motion.form>
  );
}

// ─── signup form ─────────────────────────────────────────────────────────────

function SignupForm({ onSwitch }: { onSwitch: () => void }) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    await new Promise((r) => setTimeout(r, 1500));
    setLoading(false);
  };

  return (
    <motion.form
      key="signup"
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -24 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      onSubmit={handleSubmit}
      className="flex flex-col gap-5"
    >
      <InputField
        id="signup-name"
        label="Full Name"
        placeholder="Jordan Doe"
        icon={User}
        value={name}
        onChange={setName}
      />
      <InputField
        id="signup-email"
        label="Work Email"
        type="email"
        placeholder="you@company.com"
        icon={Mail}
        value={email}
        onChange={setEmail}
      />
      <InputField
        id="signup-password"
        label="Password"
        placeholder="Min. 8 characters"
        icon={Lock}
        value={password}
        onChange={setPassword}
        showToggle
      />

      <p className="text-[10px] text-muted-foreground/60 leading-relaxed font-mono">
        By signing up you agree to our{" "}
        <a href="#" className="text-accent/70 hover:text-accent transition-colors underline underline-offset-2">
          Terms
        </a>{" "}
        and{" "}
        <a href="#" className="text-accent/70 hover:text-accent transition-colors underline underline-offset-2">
          Privacy Policy
        </a>
        .
      </p>

      <button
        type="submit"
        disabled={loading}
        className="w-full py-3 bg-accent text-accent-foreground font-semibold rounded-lg hover:brightness-110 active:scale-[0.98] transition-all flex items-center justify-center gap-2 disabled:opacity-70 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          "Create Account"
        )}
      </button>

      <p className="text-center text-xs text-muted-foreground">
        Already have an account?{" "}
        <button type="button" onClick={onSwitch} className="text-accent hover:brightness-125 transition font-medium">
          Sign in
        </button>
      </p>
    </motion.form>
  );
}

// ─── main page ───────────────────────────────────────────────────────────────

function AuthPage() {
  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: "/auth" });

  const active = tab ?? "login";
  const setTab = (t: "login" | "signup") =>
    navigate({ search: { tab: t }, replace: true });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col selection:bg-accent/30 selection:text-white">

      {/* Background */}
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 size-[700px] bg-accent/8 rounded-full animate-pulse-glow blur-3xl" />
        <div className="absolute bottom-0 right-0 size-96 bg-accent/5 rounded-full animate-pulse-glow blur-3xl" style={{ animationDelay: "3s" }} />
        {/* grid */}
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
      </div>

      {/* Top bar */}
      <header className="flex items-center justify-between px-6 py-5 max-w-7xl w-full mx-auto">
        <Link to="/" className="flex items-center gap-2 opacity-80 hover:opacity-100 transition-opacity">
          <div className="size-4 bg-foreground rounded-sm" />
          <span className="font-semibold tracking-tight text-sm uppercase">ProfileGPT</span>
        </Link>
        <Link
          to="/get-started"
          className="inline-flex items-center gap-1.5 text-[11px] font-mono text-muted-foreground hover:text-accent transition-colors uppercase tracking-widest"
        >
          <ArrowLeft className="size-3" /> Back
        </Link>
      </header>

      {/* Card */}
      <div className="flex-1 flex items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 28 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          className="w-full max-w-md"
        >
          {/* Logo lockup */}
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 mb-4 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-[10px] font-mono uppercase tracking-widest">
              <Sparkles className="size-3" />
              Neural Interface v2.4
            </div>
            <h1 className="text-2xl font-semibold tracking-tight">
              {active === "login" ? "Welcome back." : "Create your profile."}
            </h1>
            <p className="text-sm text-muted-foreground mt-1 font-light">
              {active === "login"
                ? "Sign in to access your neural profile."
                : "Upload once. Let recruiters ask, not assume."}
            </p>
          </div>

          {/* Panel */}
          <div className="bg-panel border border-border rounded-2xl overflow-hidden shadow-2xl">

            {/* Tab switcher */}
            <div className="relative flex border-b border-border bg-white/[0.02]">
              {/* sliding indicator */}
              <motion.div
                layout
                layoutId="auth-tab-indicator"
                transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                className="absolute bottom-0 h-0.5 bg-accent rounded-full"
                style={{
                  width: "50%",
                  left: active === "login" ? "0%" : "50%",
                }}
              />

              {(["login", "signup"] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`flex-1 py-4 text-[11px] font-mono uppercase tracking-widest transition-colors duration-200 ${
                    active === t ? "text-foreground" : "text-muted-foreground hover:text-foreground/70"
                  }`}
                >
                  {t === "login" ? "Sign In" : "Sign Up"}
                </button>
              ))}
            </div>

            {/* Form area */}
            <div className="p-7">
              {/* OAuth */}
              <button
                type="button"
                className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg border border-border bg-white/[0.03] hover:border-accent/30 hover:bg-white/[0.05] transition-all text-sm font-medium mb-6"
              >
                {/* Google "G" */}
                <svg className="size-4" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
                Continue with Google
              </button>

              {/* Divider */}
              <div className="flex items-center gap-3 mb-6">
                <div className="flex-1 h-px bg-border" />
                <span className="text-[10px] font-mono text-muted-foreground/50 uppercase tracking-widest">or</span>
                <div className="flex-1 h-px bg-border" />
              </div>

              {/* Animated form swap */}
              <AnimatePresence mode="wait">
                {active === "login" ? (
                  <LoginForm key="login" onSwitch={() => setTab("signup")} />
                ) : (
                  <SignupForm key="signup" onSwitch={() => setTab("login")} />
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* bottom note */}
          <p className="text-center text-[10px] font-mono text-muted-foreground/40 mt-6 uppercase tracking-widest">
            Encrypted at rest · SOC 2 Compliant
          </p>
        </motion.div>
      </div>
    </div>
  );
}