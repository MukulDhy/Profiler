import { createFileRoute, Link } from "@tanstack/react-router";
import { motion } from "framer-motion";
import { ArrowRight, Brain, MessageSquare, Radar, Sparkles, Upload, Zap } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "ProfileGPT — Your resume can finally talk" },
      {
        name: "description",
        content:
          "Transform static PDFs into intelligent AI-powered professional profiles. Recruiters chat with your experience, not your bullet points.",
      },
      { property: "og:title", content: "ProfileGPT — Your resume can finally talk" },
      {
        property: "og:description",
        content:
          "AI-powered career intelligence platform. Turn your resume into a queryable neural profile.",
      },
    ],
  }),
  component: Landing,
});

function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground selection:bg-accent/30 selection:text-white">
      <SiteNav />
      <main className="pt-32">
        {/* Hero */}
        <section className="px-6 max-w-5xl mx-auto text-center relative">
          <div className="absolute -top-20 left-1/2 -translate-x-1/2 size-96 bg-accent/20 rounded-full animate-pulse-glow -z-10" />
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: [0.16, 1, 0.3, 1] }}
          >
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-[11px] font-mono uppercase tracking-widest mb-8">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              Neural Engine v2.4 Live
            </div>
            <h1 className="text-6xl md:text-8xl font-semibold tracking-tight leading-[1.05] mb-8 text-balance">
              Your Resume Can <span className="text-accent">Finally Talk.</span>
            </h1>
            <p className="text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 text-pretty font-light leading-relaxed">
              Transform static PDFs into intelligent professional profiles.
              Recruiters don't read your resume — they interview it.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link
                to="/upload"
                className="w-full sm:w-auto px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-lg hover:scale-[1.02] active:scale-[0.98] transition-transform shadow-lg shadow-accent/20 inline-flex items-center justify-center gap-2"
              >
                <Upload className="size-4" />
                Upload Resume
              </Link>
              <Link
                to="/dashboard"
                className="w-full sm:w-auto px-8 py-4 bg-panel border border-border text-foreground font-semibold rounded-lg hover:bg-panel/80 transition-colors inline-flex items-center justify-center gap-2"
              >
                Try Live Example
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </motion.div>
        </section>

        {/* Dashboard preview */}
        <section className="mt-32 px-6 max-w-7xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: "-100px" }}
            transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
            className="relative bg-panel rounded-2xl border border-border overflow-hidden shadow-2xl"
          >
            <div className="border-b border-border p-4 flex items-center justify-between bg-white/[0.02]">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-full bg-stone-800 flex items-center justify-center text-xs font-mono">
                  JD
                </div>
                <div>
                  <h3 className="text-sm font-semibold">Jordan Doe — Full Stack Engineer</h3>
                  <p className="text-[10px] font-mono text-accent uppercase tracking-widest">
                    Analysis Complete · 98% Score
                  </p>
                </div>
              </div>
              <div className="hidden sm:flex gap-2">
                <div className="px-3 py-1 bg-white/5 rounded text-[10px] font-mono border border-border">
                  UUID: 8k2-p91
                </div>
                <div className="px-3 py-1 bg-accent/10 text-accent rounded text-[10px] font-mono border border-accent/20">
                  ACTIVE INTERFACE
                </div>
              </div>
            </div>

            <div className="grid lg:grid-cols-12 gap-px bg-border">
              <div className="lg:col-span-3 bg-panel p-6 space-y-8">
                <div>
                  <h4 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-4">
                    Skills Radar
                  </h4>
                  <div className="aspect-square bg-white/5 rounded-lg border border-border flex items-center justify-center">
                    <div className="w-4/5 h-4/5 rounded-full border border-accent/20 relative">
                      <div className="absolute inset-0 border border-white/5 scale-75 rounded-full" />
                      <div className="absolute inset-0 border border-white/5 scale-50 rounded-full" />
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-[10px] font-mono text-accent/70">ENGINEERING CORE</span>
                      </div>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-4">
                    ATS Match Score
                  </h4>
                  <div className="text-4xl font-semibold tracking-tighter">
                    98.4<span className="text-accent">%</span>
                  </div>
                  <div className="w-full h-1 bg-white/5 mt-3 rounded-full overflow-hidden">
                    <div className="w-[98%] h-full bg-accent" />
                  </div>
                </div>
              </div>

              <div className="lg:col-span-5 bg-panel p-6">
                <h4 className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider mb-4">
                  Neural Summary
                </h4>
                <div className="space-y-4">
                  <div className="p-4 bg-white/[0.02] border border-border rounded-lg">
                    <p className="text-sm leading-relaxed text-foreground/90">
                      Candidate demonstrates exceptional depth in{" "}
                      <span className="text-accent">distributed systems</span> and{" "}
                      <span className="text-accent">Node.js</span> architecture. Analysis of 4 core
                      projects reveals a consistent pattern of performance-first engineering decisions.
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 border border-border rounded flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        Experience
                      </span>
                      <span className="text-sm font-medium">8+ Years Senior</span>
                    </div>
                    <div className="p-3 border border-border rounded flex flex-col gap-1">
                      <span className="text-[10px] font-mono text-muted-foreground uppercase">
                        Leadership
                      </span>
                      <span className="text-sm font-medium">High Potential</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="lg:col-span-4 bg-panel-2 p-6 flex flex-col">
                <h4 className="text-[10px] font-mono text-accent uppercase tracking-wider mb-4 flex items-center gap-2">
                  <span className="size-1.5 bg-accent rounded-full animate-pulse" /> Direct Inquiry Interface
                </h4>
                <div className="flex-1 space-y-4 mb-6">
                  <div className="text-[11px] font-mono text-muted-foreground text-right">
                    Recruiter: Does this candidate have experience with Go?
                  </div>
                  <div className="p-3 bg-white/5 border border-border rounded-lg text-xs leading-relaxed">
                    <span className="text-accent">AI Response:</span> Yes. Jordan led the migration
                    of a monolithic PHP service to a Go microservices architecture at FintechCorp,
                    resulting in a 40% reduction in latency.
                    <span className="inline-block w-1.5 h-3 bg-accent align-middle ml-1 animate-blink" />
                  </div>
                </div>
                <div className="mt-auto relative">
                  <input
                    type="text"
                    placeholder="Ask about Jordan..."
                    className="w-full bg-panel border border-border rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors"
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-muted-foreground">
                    ↵
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        </section>

        {/* Features */}
        <section id="features" className="py-32 px-6 max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row items-end justify-between mb-16 gap-4">
            <div className="max-w-xl">
              <h2 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4 text-balance">
                Built for High-Signal Recruiting.
              </h2>
              <p className="text-muted-foreground leading-relaxed">
                Stop scanning bullet points. Use our intelligence engine to identify high-impact
                talent across your entire pipeline instantly.
              </p>
            </div>
            <Link
              to="/dashboard"
              className="text-accent font-mono text-xs uppercase tracking-widest border-b border-accent/30 pb-1 hover:border-accent transition-all"
            >
              Explore the dashboard →
            </Link>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                Icon: Brain,
                title: "Project Deep-Dive",
                body: "AI extracts technical decisions and architecture patterns from every project mentioned in the resume.",
              },
              {
                Icon: MessageSquare,
                title: "Contextual AI Chat",
                body: "Recruiters ask questions. The model answers using only the candidate's verifiable history.",
              },
              {
                Icon: Radar,
                title: "Competitive Benchmarking",
                body: "See how a candidate ranks against peers for specific roles based on real career trajectory.",
              },
            ].map(({ Icon, title, body }) => (
              <div
                key={title}
                className="group p-8 bg-panel border border-border rounded-xl hover:border-accent/40 transition-colors"
              >
                <div className="size-10 bg-white/5 rounded mb-6 flex items-center justify-center border border-border group-hover:border-accent/40 transition-colors">
                  <Icon className="size-4 text-accent" />
                </div>
                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="py-24 px-6 max-w-7xl mx-auto border-t border-border">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {[
              {
                num: "01 — INGESTION",
                title: "Paper to Vector",
                body: "Drop any legacy format. The neural parser decomposes text, structure, and semantic context into a high-dimensional vector space.",
              },
              {
                num: "02 — SIMULATION",
                title: "Experience Synthesis",
                body: "We rebuild the candidate's history as a queryable intelligence. Recruiter questions trigger reasoning grounded in actual past projects.",
              },
              {
                num: "03 — DEPLOYMENT",
                title: "The Living Link",
                body: "Share one URL. Recruiters chat with the candidate's twin, run role-fit scoring, and generate interview loops instantly.",
              },
            ].map((s) => (
              <div key={s.num}>
                <div className="font-mono text-accent mb-4 text-xs tracking-widest">{s.num}</div>
                <h3 className="text-xl font-medium mb-3">{s.title}</h3>
                <p className="text-sm text-muted-foreground text-pretty max-w-[36ch] leading-relaxed">
                  {s.body}
                </p>
              </div>
            ))}
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="py-24 px-6 max-w-7xl mx-auto border-t border-border">
          <h2 className="text-4xl font-semibold tracking-tight text-center mb-4">
            Simple, intelligent pricing.
          </h2>
          <p className="text-center text-muted-foreground mb-16">
            Start free. Upgrade when recruiters start chatting.
          </p>
          <div className="grid md:grid-cols-3 gap-6">
            {[
              { name: "Starter", price: "Free", body: "1 profile · 50 chat queries / mo", cta: "Begin" },
              { name: "Pro", price: "$19", body: "Unlimited chats · custom domain · analytics", cta: "Upgrade", featured: true },
              { name: "Teams", price: "$49", body: "Recruiter dashboards · 5 seats · SSO", cta: "Contact" },
            ].map((t) => (
              <div
                key={t.name}
                className={`p-8 rounded-xl border ${
                  t.featured
                    ? "border-accent/40 bg-accent/5 ring-1 ring-accent/20"
                    : "border-border bg-panel"
                }`}
              >
                <div className="flex items-center justify-between mb-6">
                  <h3 className="font-semibold">{t.name}</h3>
                  {t.featured && (
                    <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
                      Recommended
                    </span>
                  )}
                </div>
                <div className="text-4xl font-semibold tracking-tight mb-2">
                  {t.price}
                  <span className="text-sm text-muted-foreground font-normal">/mo</span>
                </div>
                <p className="text-sm text-muted-foreground mb-8 leading-relaxed">{t.body}</p>
                <Link
                  to="/upload"
                  className={`block text-center px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                    t.featured
                      ? "bg-accent text-accent-foreground hover:brightness-110"
                      : "border border-border hover:border-accent/40"
                  }`}
                >
                  {t.cta}
                </Link>
              </div>
            ))}
          </div>
        </section>

        {/* FAQ */}
        <section className="py-24 px-6 max-w-3xl mx-auto border-t border-border">
          <h2 className="text-3xl font-semibold tracking-tight mb-10">Frequently asked.</h2>
          <div className="space-y-3">
            {[
              { q: "How private is my resume?", a: "Encrypted at rest. You control the share URL and can revoke anytime." },
              { q: "Can recruiters export my data?", a: "No. The chat interface is read-only and instrumented for misuse." },
              { q: "Does it work with DOCX?", a: "PDF, DOCX, and Markdown. We extract structure, not just text." },
              { q: "Do I need to write prompts?", a: "No. The model is grounded on your resume and answers in your voice." },
            ].map((f) => (
              <details
                key={f.q}
                className="group p-5 rounded-lg border border-border bg-panel open:border-accent/30 transition-colors"
              >
                <summary className="flex items-center justify-between cursor-pointer text-sm font-medium">
                  {f.q}
                  <Zap className="size-4 text-accent group-open:rotate-45 transition-transform" />
                </summary>
                <p className="text-sm text-muted-foreground mt-3 leading-relaxed">{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* CTA */}
        <section className="px-6 pb-24">
          <div className="max-w-5xl mx-auto p-12 rounded-2xl border border-border bg-panel relative overflow-hidden">
            <div className="absolute -top-20 -right-20 size-80 bg-accent/15 rounded-full animate-pulse-glow" />
            <div className="relative">
              <Sparkles className="size-6 text-accent mb-6" />
              <h2 className="text-4xl font-semibold tracking-tight mb-4 text-balance">
                Ready to breathe life into your career?
              </h2>
              <p className="text-muted-foreground mb-8 max-w-xl">
                Upload once. Share forever. Let recruiters ask, not assume.
              </p>
              <Link
                to="/upload"
                className="inline-flex items-center gap-2 px-8 py-4 bg-accent text-accent-foreground font-semibold rounded-lg hover:brightness-110 transition-all"
              >
                Upload Your Resume <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border py-12 px-6">
        <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-8">
          <div className="flex items-center gap-2 opacity-60">
            <div className="size-4 bg-foreground rounded-sm" />
            <span className="font-semibold tracking-tight text-sm uppercase">ProfileGPT</span>
          </div>
          <div className="flex gap-8 text-[11px] font-mono text-muted-foreground uppercase tracking-tighter">
            <a href="#" className="hover:text-accent transition-colors">Twitter</a>
            <a href="#" className="hover:text-accent transition-colors">GitHub</a>
            <a href="#" className="hover:text-accent transition-colors">Security</a>
            <a href="#" className="hover:text-accent transition-colors">Privacy</a>
          </div>
          <div className="text-[11px] font-mono text-muted-foreground">© 2026 Neural Interface Labs</div>
        </div>
      </footer>
    </div>
  );
}
