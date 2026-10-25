import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, LogIn, Play, Sparkles } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";

export const Route = createFileRoute("/get-started")({
  head: () => ({
    meta: [
      { title: "Get Started — ProfileGPT" },
      {
        name: "description",
        content: "Start building your AI-powered professional profile today.",
      },
    ],
  }),
  component: GetStarted,
});

const STEPS = [
  { label: "01", text: "Upload your resume" },
  { label: "02", text: "AI analyzes & indexes it" },
  { label: "03", text: "Share your living profile" },
];

function GetStarted() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent/30 selection:text-white">
      <SiteNav />

      <main className="pt-32 pb-24 px-6 flex flex-col items-center justify-center relative overflow-hidden">
        {/* Ambient glow layers */}
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute top-1/4 left-1/2 -translate-x-1/2 size-[600px] bg-accent/10 rounded-full animate-pulse-glow blur-3xl" />
          <div className="absolute top-1/3 left-1/4 size-72 bg-accent/5 rounded-full animate-pulse-glow blur-2xl" style={{ animationDelay: "2s" }} />
          <div className="absolute top-1/3 right-1/4 size-72 bg-accent/5 rounded-full animate-pulse-glow blur-2xl" style={{ animationDelay: "4s" }} />
          {/* Subtle grid */}
          <div
            className="absolute inset-0 opacity-[0.03]"
            style={{
              backgroundImage:
                "linear-gradient(oklch(1 0 0) 1px, transparent 1px), linear-gradient(90deg, oklch(1 0 0) 1px, transparent 1px)",
              backgroundSize: "60px 60px",
            }}
          />
        </div>

        {/* Badge */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-[11px] font-mono uppercase tracking-widest mb-10"
        >
          <Sparkles className="size-3" />
          Begin Your Neural Profile
        </motion.div>

        {/* Heading */}
        <motion.h1
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
          className="text-5xl md:text-7xl font-semibold tracking-tight leading-[1.05] text-center text-balance mb-6 max-w-3xl"
        >
          One upload.<br />
          <span className="text-accent">Infinite conversations.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="text-base md:text-lg text-muted-foreground max-w-lg text-center mb-14 font-light leading-relaxed"
        >
          Turn your static resume into a queryable intelligence. Recruiters
          stop scanning — they start asking.
        </motion.p>

        {/* CTA Cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="grid sm:grid-cols-2 gap-5 w-full max-w-2xl mb-20"
        >
          {/* Try First */}
          <Link
            to="/upload"
            className="group relative p-8 rounded-2xl border border-border bg-panel hover:border-accent/40 transition-all duration-300 flex flex-col gap-5 overflow-hidden"
          >
            {/* Hover fill */}
            <div className="absolute inset-0 bg-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

            <div className="relative flex items-center justify-between">
              <div className="size-11 rounded-xl bg-white/5 border border-border group-hover:border-accent/40 transition-colors flex items-center justify-center">
                <Play className="size-5 text-accent fill-accent/20" />
              </div>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
                No signup
              </span>
            </div>

            <div className="relative">
              <h2 className="text-xl font-semibold mb-2">Try it first</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Explore a live example profile. Chat with Jordan Doe's neural
                twin — no account needed.
              </p>
            </div>

            <div className="relative mt-auto inline-flex items-center gap-2 text-accent text-xs font-mono uppercase tracking-widest">
              Launch demo
              <ArrowRight className="size-3 group-hover:translate-x-1 transition-transform" />
            </div>
          </Link>

          {/* Login / Signup */}
          <Link
              to="/auth"
              search={{ tab: "login" }}
              className="group relative p-8 rounded-2xl border border-accent/30 bg-accent/5 ring-1 ring-accent/10 hover:ring-accent/30 hover:border-accent/60 transition-all duration-300 flex flex-col gap-5 overflow-hidden"
            >
            {/* Animated corner accent */}
            <div className="absolute -top-12 -right-12 size-32 bg-accent/20 rounded-full animate-pulse-glow blur-2xl" />

            <div className="relative flex items-center justify-between">
              <div className="size-11 rounded-xl bg-accent/15 border border-accent/30 group-hover:border-accent/50 transition-colors flex items-center justify-center">
                <LogIn className="size-5 text-accent" />
              </div>
              <span className="font-mono text-[10px] text-accent uppercase tracking-widest">
                Recommended
              </span>
            </div>

            <div className="relative">
              <h2 className="text-xl font-semibold mb-2">Login / Sign up</h2>
              <p className="text-sm text-muted-foreground leading-relaxed">
                Create your account, upload your resume, and get your shareable
                profile URL in under 60 seconds.
              </p>
            </div>

            <div className="relative mt-auto inline-flex items-center gap-2 font-semibold text-sm px-5 py-2.5 bg-accent text-accent-foreground rounded-lg group-hover:brightness-110 transition-all w-fit">
              Get started free
              <ArrowRight className="size-4 group-hover:translate-x-0.5 transition-transform" />
            </div>
          </Link>
        </motion.div>

        {/* How it works — compact stepper */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.55 }}
          className="w-full max-w-2xl"
        >
          <p className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest text-center mb-8">
            How it works
          </p>
          <div className="relative flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            {/* connector line */}
            <div className="hidden sm:block absolute left-0 right-0 top-5 h-px bg-gradient-to-r from-transparent via-border to-transparent" />

            {STEPS.map((step, i) => (
              <div key={step.label} className="relative flex sm:flex-col items-center sm:items-center gap-4 sm:gap-3 flex-1">
                <div className="shrink-0 size-10 rounded-full bg-panel border border-border flex items-center justify-center font-mono text-[10px] text-accent tracking-widest z-10">
                  {step.label}
                </div>
                <p className="text-xs text-muted-foreground sm:text-center">{step.text}</p>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Trust line */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.7 }}
          className="mt-16 text-[11px] font-mono text-muted-foreground/60 text-center"
        >
          Encrypted at rest · No card required · Revoke anytime
        </motion.p>
      </main>
    </div>
  );
}