import { createFileRoute } from "@tanstack/react-router";
import {
  Radar,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import { AppShell } from "@/components/layout/AppShell";
import {
  candidate,
  radarSkills,
  codingActivity,
  skills,
  timeline,
  platforms,
} from "@/data/mock";
import { Github, Linkedin, Code2, Trophy, ArrowUpRight, Sparkles } from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [
      { title: "Intelligence Dashboard — ProfileGPT" },
      { name: "description", content: "AI-powered analysis of a candidate's resume, skills, and projects." },
    ],
  }),
  component: () => (
    <AppShell>
      <Dashboard />
    </AppShell>
  ),
});

function Dashboard() {
  return (
    <div className="min-h-screen">
      <Header />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        <StatGrid />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AISummary />
          <ATSCard />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillsRadar />
          <CodingActivity />
        </div>
        <SkillsBreakdown />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Timeline />
          <ConnectedPlatforms />
        </div>
      </div>
    </div>
  );
}

function Header() {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-4 px-6 lg:px-8 h-16">
        <div className="size-9 rounded-full bg-stone-800 flex items-center justify-center text-xs font-mono">
          {candidate.initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{candidate.name}</div>
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest">
            {candidate.title} · UUID {candidate.uuid}
          </div>
        </div>
        <div className="ml-auto hidden md:flex items-center gap-2">
          <input
            placeholder="Search insights, projects, skills…"
            className="bg-panel border border-border rounded-md px-3 py-2 text-sm w-72 focus:outline-none focus:border-accent transition-colors"
          />
          <button className="px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-semibold hover:brightness-110 transition-all">
            Share Profile
          </button>
        </div>
      </div>
    </header>
  );
}

function StatGrid() {
  const stats = [
    { label: "ATS Score", value: `${candidate.atsScore}%`, sub: "Optimized" },
    { label: "Experience", value: `${candidate.experienceYears}+ yrs`, sub: "Senior tier" },
    { label: "Projects", value: "4", sub: "Production-grade" },
    { label: "Recruiter Fit", value: "94%", sub: "Backend roles" },
  ];
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label} className="p-5 rounded-xl border border-border bg-panel">
          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-2">
            {s.label}
          </div>
          <div className="text-2xl font-semibold tracking-tight">{s.value}</div>
          <div className="text-xs text-accent mt-1">{s.sub}</div>
        </div>
      ))}
    </div>
  );
}

function AISummary() {
  return (
    <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Neural Summary
        </h3>
        <Sparkles className="size-4 text-accent" />
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 mb-6">{candidate.summary}</p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-accent mb-2">Strengths</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {candidate.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-accent">›</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">Growth Areas</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {candidate.weaknesses.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="opacity-60">›</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="mt-6 p-4 rounded-lg border border-accent/20 bg-accent/5">
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
          Recruiter impression
        </div>
        <p className="text-sm text-foreground/90 leading-relaxed">{candidate.recruiterImpression}</p>
      </div>
    </div>
  );
}

function ATSCard() {
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
        ATS Analysis
      </h3>
      <div className="text-5xl font-semibold tracking-tighter mb-2">
        {candidate.atsScore}
        <span className="text-accent">%</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-accent" style={{ width: `${candidate.atsScore}%` }} />
      </div>
      <div className="space-y-3 text-sm">
        <Row label="Keyword match" value="42 / 45" />
        <Row label="Formatting" value="Pass" />
        <Row label="Missing keywords" value="Rust, gRPC" tone="warn" />
      </div>
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: string; tone?: "warn" }) {
  return (
    <div className="flex justify-between items-center text-muted-foreground">
      <span>{label}</span>
      <span className={tone === "warn" ? "text-accent font-mono text-xs" : "text-foreground font-medium"}>
        {value}
      </span>
    </div>
  );
}

function SkillsRadar() {
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
        Skills Intelligence Matrix
      </h3>
      <div className="h-72">
        <ResponsiveContainer>
          <RadarChart data={radarSkills} outerRadius="80%">
            <PolarGrid stroke="rgba(255,255,255,0.08)" />
            <PolarAngleAxis dataKey="axis" tick={{ fill: "var(--muted-foreground)", fontSize: 11 }} />
            <Radar
              dataKey="value"
              stroke="var(--accent)"
              fill="var(--accent)"
              fillOpacity={0.25}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function CodingActivity() {
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
        Coding Activity (last 8 months)
      </h3>
      <div className="h-72">
        <ResponsiveContainer>
          <AreaChart data={codingActivity} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
            <XAxis dataKey="month" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <YAxis stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} />
            <Tooltip
              contentStyle={{
                background: "var(--panel)",
                border: "1px solid var(--border)",
                borderRadius: 8,
                fontSize: 12,
              }}
            />
            <Area type="monotone" dataKey="commits" stroke="var(--accent)" fill="url(#grad)" />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function SkillsBreakdown() {
  const groups = Array.from(new Set(skills.map((s) => s.group)));
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
        Skills Breakdown
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {groups.map((g) => (
          <div key={g}>
            <h4 className="text-xs font-semibold text-accent mb-3">{g}</h4>
            <div className="space-y-2.5">
              {skills.filter((s) => s.group === g).map((s) => (
                <div key={s.name}>
                  <div className="flex justify-between text-xs mb-1">
                    <span className="text-foreground/90">{s.name}</span>
                    <span className="font-mono text-muted-foreground">{s.level}</span>
                  </div>
                  <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                    <div className="h-full bg-accent" style={{ width: `${s.level}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function Timeline() {
  return (
    <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
        Experience Timeline
      </h3>
      <div className="relative pl-6">
        <div className="absolute top-1 bottom-1 left-1.5 w-px bg-border" />
        {timeline.map((t) => (
          <div key={t.year + t.org} className="relative pb-6 last:pb-0">
            <div className="absolute -left-[18px] top-1 size-3 rounded-full border-2 border-accent bg-background" />
            <div className="flex items-baseline gap-3 mb-1">
              <span className="font-mono text-xs text-accent">{t.year}</span>
              <span className="text-sm font-medium">{t.role}</span>
              <span className="text-xs text-muted-foreground">@ {t.org}</span>
            </div>
            <p className="text-sm text-muted-foreground">{t.blurb}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConnectedPlatforms() {
  const icon = (n: string) =>
    n === "GitHub" ? <Github className="size-4" /> :
    n === "LinkedIn" ? <Linkedin className="size-4" /> :
    n === "LeetCode" ? <Code2 className="size-4" /> :
    <Trophy className="size-4" />;
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
        Connected Platforms
      </h3>
      <div className="space-y-3">
        {platforms.map((p) => (
          <div
            key={p.name}
            className="flex items-center gap-3 p-3 rounded-lg border border-border hover:border-accent/30 transition-colors group"
          >
            <div className="size-8 rounded bg-accent/10 border border-accent/20 flex items-center justify-center text-accent">
              {icon(p.name)}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium">{p.name}</div>
              <div className="text-xs text-muted-foreground truncate">{p.stat}</div>
            </div>
            <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
          </div>
        ))}
      </div>
    </div>
  );
}
