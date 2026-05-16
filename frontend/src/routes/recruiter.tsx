import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { AppShell } from "@/components/layout/AppShell";
import { candidate, recruiterInsights } from "@/data/mock";
import { CheckCircle2, MessageSquare, ThumbsUp, Briefcase } from "lucide-react";

export const Route = createFileRoute("/recruiter")({
  head: () => ({
    meta: [
      { title: "Recruiter View — ProfileGPT" },
      { name: "description", content: "Hiring recommendation and role-fit analysis for the candidate." },
    ],
  }),
  component: () => (
    <AppShell>
      <Recruiter />
    </AppShell>
  ),
});

function Recruiter() {
  const [role, setRole] = useState(recruiterInsights.roleFits[0]);

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      <div>
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
          Recruiter Dashboard
        </div>
        <h1 className="text-3xl font-semibold tracking-tight">Hiring intelligence for {candidate.name}</h1>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-panel">
          <div className="flex items-start gap-4 mb-6">
            <div className="size-14 rounded-full bg-stone-800 flex items-center justify-center font-mono text-sm">
              {candidate.initials}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{candidate.name}</h2>
              <p className="text-sm text-muted-foreground">
                {candidate.title} · {candidate.location} · {candidate.experienceYears}+ years
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 text-[10px] font-mono uppercase tracking-widest">
              Strong Hire
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-6">
            {candidate.recruiterImpression}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["ATS", `${candidate.atsScore}%`],
              ["Tech Depth", "94th %"],
              ["Leadership", "High"],
            ].map(([k, v]) => (
              <div key={k} className="p-3 rounded-md border border-border">
                <div className="text-[10px] font-mono text-muted-foreground uppercase">{k}</div>
                <div className="text-base font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl border border-accent/30 bg-accent/5">
          <ThumbsUp className="size-5 text-accent mb-3" />
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
            Hiring Recommendation
          </div>
          <div className="text-2xl font-semibold mb-2">Move to onsite.</div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            Skip the technical phone screen. Recommend a system design loop focused on
            distributed systems and a Go coding round.
          </p>
        </div>
      </div>

      {/* Role fit selector */}
      <div className="p-6 rounded-xl border border-border bg-panel">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
          Evaluate for role
        </h3>
        <div className="flex flex-wrap gap-2 mb-6">
          {recruiterInsights.roleFits.map((r) => (
            <button
              key={r.role}
              onClick={() => setRole(r)}
              className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                role.role === r.role
                  ? "bg-accent text-accent-foreground border-accent"
                  : "border-border hover:border-accent/40"
              }`}
            >
              <Briefcase className="size-3" />
              {r.role}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <div>
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
              Match Score
            </div>
            <div className="text-5xl font-semibold tracking-tighter">
              {role.score}
              <span className="text-accent text-2xl">%</span>
            </div>
          </div>
          <div className="md:col-span-2">
            <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
              Verdict
            </div>
            <div className="text-xl font-semibold mb-2">{role.verdict}</div>
            <div className="h-2 bg-white/5 rounded-full overflow-hidden">
              <div className="h-full bg-accent" style={{ width: `${role.score}%` }} />
            </div>
          </div>
        </div>
      </div>

      {/* Strengths / Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-border bg-panel">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Strengths
          </h3>
          <ul className="space-y-2">
            {candidate.strengths.map((s) => (
              <li key={s} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="size-4 text-accent mt-0.5 shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 rounded-xl border border-border bg-panel">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Growth Areas
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {candidate.weaknesses.map((s) => (
              <li key={s} className="flex items-start gap-2">
                <span className="text-accent mt-0.5">›</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Interview questions */}
      <div className="p-6 rounded-xl border border-border bg-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Generated Interview Questions
          </h3>
          <Link
            to="/chat"
            className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline inline-flex items-center gap-1"
          >
            <MessageSquare className="size-3" /> Continue in chat
          </Link>
        </div>
        <ol className="space-y-3">
          {recruiterInsights.interviewQuestions.map((q, i) => (
            <li key={q} className="flex gap-3 p-3 rounded-md border border-border">
              <span className="font-mono text-xs text-accent">{String(i + 1).padStart(2, "0")}</span>
              <span className="text-sm">{q}</span>
            </li>
          ))}
        </ol>
      </div>
    </div>
  );
}
