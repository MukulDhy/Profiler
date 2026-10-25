import { useEffect, useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
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
  getLatestResumeProfile,
  getResumeProfile,
  getRememberedResumeId,
  getMyGithubActivity,
  shareResume,
  revokeResumeShare,
  LAST_RESUME_KEY,
} from "@/lib/api";
import { ShareDialog } from "@/components/share/ShareDialog";
import {
  buildDashboardView,
  type DashboardCandidate,
  type DashboardView,
} from "@/lib/view";
import type {
  CodingActivityPoint,
  GithubActivity,
  Platform,
  RadarSkill,
  Sharing,
  Skill,
  TimelineItem,
} from "@/lib/types";
import {
  Github,
  Linkedin,
  Code2,
  Trophy,
  ArrowUpRight,
  Sparkles,
  AlertCircle,
  Loader2,
  Search,
  Share2,
  Star,
  GitFork,
} from "lucide-react";

export const Route = createFileRoute("/dashboard")({
  validateSearch: (search: Record<string, unknown>): { id?: string } => ({
    id: typeof search.id === "string" && search.id ? search.id : undefined,
  }),
  head: () => ({
    meta: [
      { title: "Intelligence Dashboard — ProfileGPT" },
      {
        name: "description",
        content:
          "AI-powered analysis of a candidate's resume, skills, and projects.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <DashboardPage />
    </AppShell>
  ),
});

function DashboardPage() {
  const { id } = Route.useSearch();
  const [storedId, setStoredId] = useState<string | undefined>(undefined);

  useEffect(() => {
    setStoredId(id ?? getRememberedResumeId());
  }, [id]);

  const activeId = id ?? storedId;

  const [search, setSearch] = useState("");
  const [shareOpen, setShareOpen] = useState(false);
  const [sharing, setSharing] = useState<Sharing | null>(null);

  const query = useQuery({
    queryKey: ["resume-profile", activeId ?? "latest"],
    queryFn: ({ signal }) =>
      activeId
        ? getResumeProfile(activeId, signal)
        : getLatestResumeProfile(signal),
    refetchInterval: (current) =>
      current.state.data?.processingStatus === "processing" ? 3000 : false,
    // Never call the API from the SSR worker; hydrate then fetch on the client.
    enabled: typeof window !== "undefined",
    retry: 1,
    staleTime: 15_000,
  });

  useEffect(() => {
    setSharing(query.data?.sharing ?? null);
  }, [query.data?.sharing]);

  const githubQuery = useQuery({
    queryKey: ["github-activity", query.data?.upload?.id ?? "none"],
    queryFn: () => getMyGithubActivity(),
    enabled:
      typeof window !== "undefined" &&
      Boolean(query.data?.profile) &&
      query.data?.processingStatus === "completed",
    retry: false,
    staleTime: 10 * 60 * 1000,
  });

  const view = useMemo(
    () =>
      buildDashboardView(
        query.data?.profile ?? null,
        query.data?.analysisMeta ?? null,
        Boolean(query.data?.profile)
      ),
    [query.data]
  );

  const isExplicit = Boolean(activeId);

  if (isExplicit && query.isPending) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center gap-4 text-center px-6">
        <Loader2 className="size-6 text-accent animate-spin" />
        <div>
          <p className="text-sm font-medium">Loading your intelligence profile…</p>
          <p className="text-xs text-muted-foreground mt-1">
            Fetching the latest analysis from the backend.
          </p>
        </div>
      </div>
    );
  }

  if (isExplicit && query.isError && !query.data) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center px-6">
        <div className="max-w-md w-full p-6 rounded-xl border border-border bg-panel text-center">
          <AlertCircle className="size-6 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Could not load this profile</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {query.error instanceof Error
              ? query.error.message
              : "Unknown error."}
          </p>
          <div className="flex flex-wrap justify-center gap-2">
            <button
              onClick={() => query.refetch()}
              className="px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-semibold hover:brightness-110 transition-all"
            >
              Try again
            </button>
            <button
              onClick={() => {
                try {
                  window.localStorage.removeItem(LAST_RESUME_KEY);
                } catch {
                  // ignore
                }
                setStoredId(undefined);
                query.refetch();
              }}
              className="px-4 py-2 border border-border rounded-md text-sm hover:border-accent/40 transition-colors"
            >
              View demo data
            </button>
            <Link
              to="/upload"
              className="px-4 py-2 border border-border rounded-md text-sm hover:border-accent/40 transition-colors"
            >
              Upload a resume
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-full">
      {query.data?.processingStatus === "processing" && (
        <div className="border-b border-accent/20 bg-accent/5 px-6 lg:px-8 py-2 text-xs text-accent flex items-center gap-2">
          <Loader2 className="size-3 animate-spin" />
          Analysis is running — this page refreshes automatically.
        </div>
      )}
      {query.data?.processingStatus === "failed" && (
        <div className="border-b border-red-500/30 bg-red-500/10 px-6 lg:px-8 py-2 text-xs text-red-300 flex items-center gap-2">
          <AlertCircle className="size-3 shrink-0" />
          <span className="truncate">
            Analysis failed:{" "}
            {query.data.analysisMeta?.error || "unknown error"} — upload the
            resume again to retry.
          </span>
        </div>
      )}
      <Header
        candidate={view.candidate}
        isLive={view.isLive}
        search={search}
        onSearch={setSearch}
        shared={Boolean(sharing?.isPublic)}
        onShare={() => setShareOpen(true)}
      />
      <div className="p-6 lg:p-8 space-y-6 max-w-[1400px] mx-auto">
        {search.trim() && <SearchResults view={view} query={search} />}
        <StatGrid view={view} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <AISummary candidate={view.candidate} />
          <ATSCard view={view} />
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <SkillsRadar data={view.radarSkills} />
          <CodingActivity
            data={githubQuery.data?.activity ?? view.codingActivity}
            github={githubQuery.data ?? null}
          />
        </div>
        <SkillsBreakdown skills={view.skills} />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <Timeline timeline={view.timeline} />
          <ConnectedPlatforms platforms={view.platforms} />
        </div>
        {githubQuery.data && <GithubPanel github={githubQuery.data} />}
      </div>

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        sharing={sharing}
        resumeId={query.data?.upload?.id}
        onShare={async (resumeId) => {
          const next = await shareResume(resumeId);
          setSharing(next);
          return next;
        }}
        onRevoke={async (resumeId) => {
          const next = await revokeResumeShare(resumeId);
          setSharing(next);
          return next;
        }}
      />
    </div>
  );
}

function Header({
  candidate,
  isLive,
  search,
  onSearch,
  shared,
  onShare,
}: {
  candidate: DashboardCandidate;
  isLive: boolean;
  search: string;
  onSearch: (value: string) => void;
  shared: boolean;
  onShare: () => void;
}) {
  return (
    <header className="sticky top-0 z-30 border-b border-border bg-background/80 backdrop-blur-md">
      <div className="flex items-center gap-4 px-6 lg:px-8 h-16">
        <div className="size-9 rounded-full bg-stone-800 flex items-center justify-center text-xs font-mono">
          {candidate.initials}
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">{candidate.name}</div>
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest truncate">
            {candidate.title} · UUID {candidate.uuid}
          </div>
        </div>
        <div className="ml-auto flex items-center gap-2">
          <span
            className={`hidden sm:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border text-[10px] font-mono uppercase tracking-widest ${
              isLive
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-panel text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                isLive ? "bg-accent" : "bg-muted-foreground"
              }`}
            />
            {isLive ? "Live analysis" : "Demo data"}
          </span>
          <div className="hidden md:flex relative items-center">
            <Search className="absolute left-2.5 size-3.5 text-muted-foreground pointer-events-none" />
            <input
              value={search}
              onChange={(event) => onSearch(event.target.value)}
              placeholder="Search insights, projects, skills…"
              className="bg-panel border border-border rounded-md pl-8 pr-3 py-2 text-sm w-64 focus:outline-none focus:border-accent transition-colors"
            />
          </div>
          <button
            onClick={onShare}
            className="hidden sm:inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-semibold hover:brightness-110 transition-all"
          >
            <Share2 className="size-3.5" />
            {shared ? "Manage Share" : "Share Profile"}
          </button>
        </div>
      </div>
    </header>
  );
}

function StatGrid({ view }: { view: DashboardView }) {
  const stats = [
    {
      label: "ATS Score",
      value: `${formatScore(view.candidate.atsScore)}%`,
      sub: view.isLive ? "AI evaluated" : "Optimized",
    },
    {
      label: "Experience",
      value: `${view.candidate.experienceYears}+ yrs`,
      sub: "From resume timeline",
    },
    {
      label: "Projects",
      value: String(view.projectCount),
      sub: "Extracted from resume",
    },
    {
      label: "Recruiter Fit",
      value: view.recruiterFit !== null ? `${view.recruiterFit}%` : "—",
      sub: view.isLive ? "Best matching role" : "Backend roles",
    },
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

function AISummary({ candidate }: { candidate: DashboardCandidate }) {
  return (
    <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Neural Summary
        </h3>
        <Sparkles className="size-4 text-accent" />
      </div>
      <p className="text-sm leading-relaxed text-foreground/90 mb-6">
        {candidate.summary || "No summary was produced for this resume."}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h4 className="text-xs font-semibold text-accent mb-2">Strengths</h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {candidate.strengths.length === 0 && (
              <li className="text-muted-foreground/70">No strengths extracted.</li>
            )}
            {candidate.strengths.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="text-accent">›</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-xs font-semibold text-muted-foreground mb-2">
            Growth Areas
          </h4>
          <ul className="space-y-1.5 text-sm text-muted-foreground">
            {candidate.weaknesses.length === 0 && (
              <li className="text-muted-foreground/70">No growth areas extracted.</li>
            )}
            {candidate.weaknesses.map((s) => (
              <li key={s} className="flex gap-2">
                <span className="opacity-60">›</span>
                {s}
              </li>
            ))}
          </ul>
        </div>
      </div>
      {candidate.recruiterImpression && (
        <div className="mt-6 p-4 rounded-lg border border-accent/20 bg-accent/5">
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
            Recruiter impression
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed">
            {candidate.recruiterImpression}
          </p>
        </div>
      )}
    </div>
  );
}

function ATSCard({ view }: { view: DashboardView }) {
  const { ats, candidate } = view;
  const score = clampPercent(candidate.atsScore);

  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
        ATS Analysis
      </h3>
      <div className="text-5xl font-semibold tracking-tighter mb-2">
        {formatScore(candidate.atsScore)}
        <span className="text-accent">%</span>
      </div>
      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-6">
        <div className="h-full bg-accent" style={{ width: `${score}%` }} />
      </div>
      <div className="space-y-3 text-sm">
        <Row
          label="Keyword match"
          value={
            ats.keywordMatch.total > 0
              ? `${ats.keywordMatch.matched} / ${ats.keywordMatch.total}`
              : "—"
          }
        />
        <Row label="Formatting" value={ats.formatting} />
        <Row
          label="Missing keywords"
          value={
            ats.missingKeywords.length > 0
              ? ats.missingKeywords.join(", ")
              : "None detected"
          }
          tone={ats.missingKeywords.length > 0 ? "warn" : undefined}
        />
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn";
}) {
  return (
    <div className="flex justify-between items-center gap-3 text-muted-foreground">
      <span className="shrink-0">{label}</span>
      <span
        className={
          tone === "warn"
            ? "text-accent font-mono text-xs text-right"
            : "text-foreground font-medium text-right"
        }
      >
        {value}
      </span>
    </div>
  );
}

function SkillsRadar({ data }: { data: RadarSkill[] }) {
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
        Skills Intelligence Matrix
      </h3>
      <div className="h-72">
        {data.length < 3 ? (
          <EmptyState message="Not enough skill data to build the radar chart." />
        ) : (
          <ResponsiveContainer>
            <RadarChart data={data} outerRadius="80%">
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis
                dataKey="axis"
                tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              />
              <Radar
                dataKey="value"
                stroke="var(--accent)"
                fill="var(--accent)"
                fillOpacity={0.25}
              />
            </RadarChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function CodingActivity({
  data,
  github,
}: {
  data: CodingActivityPoint[];
  github: GithubActivity | null;
}) {
  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <div className="flex items-center justify-between gap-3 mb-4">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Coding Activity (last 8 months)
        </h3>
        {github && (
          <a
            href={github.user.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-widest text-accent hover:underline"
          >
            <Github className="size-3" />@{github.username}
          </a>
        )}
      </div>
      <div className="h-72">
        {data.length === 0 ? (
          <EmptyState message="A resume cannot provide commit history. Connect a GitHub account to unlock this chart." />
        ) : (
          <ResponsiveContainer>
            <AreaChart
              data={data}
              margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
            >
              <defs>
                <linearGradient id="grad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--accent)" stopOpacity={0.5} />
                  <stop offset="100%" stopColor="var(--accent)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis
                dataKey="month"
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                stroke="var(--muted-foreground)"
                fontSize={11}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--panel)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  fontSize: 12,
                }}
              />
              <Area
                type="monotone"
                dataKey="commits"
                stroke="var(--accent)"
                fill="url(#grad)"
              />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
}

function SkillsBreakdown({ skills }: { skills: Skill[] }) {
  const groups = Array.from(new Set(skills.map((s) => s.group)));

  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
        Skills Breakdown
      </h3>
      {groups.length === 0 ? (
        <EmptyState message="No skills were extracted from this resume." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {groups.map((g) => (
            <div key={g}>
              <h4 className="text-xs font-semibold text-accent mb-3">{g}</h4>
              <div className="space-y-2.5">
                {skills
                  .filter((s) => s.group === g)
                  .map((s) => (
                    <div key={s.name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-foreground/90">{s.name}</span>
                        <span className="font-mono text-muted-foreground">
                          {s.level}
                        </span>
                      </div>
                      <div className="h-1 bg-white/5 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-accent"
                          style={{ width: `${clampPercent(s.level)}%` }}
                        />
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Timeline({ timeline }: { timeline: TimelineItem[] }) {
  return (
    <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
        Experience Timeline
      </h3>
      {timeline.length === 0 ? (
        <EmptyState message="No work history could be extracted from this resume." />
      ) : (
        <div className="relative pl-6">
          <div className="absolute top-1 bottom-1 left-1.5 w-px bg-border" />
          {timeline.map((t) => (
            <div key={`${t.year}-${t.org}-${t.role}`} className="relative pb-6 last:pb-0">
              <div className="absolute -left-[18px] top-1 size-3 rounded-full border-2 border-accent bg-background" />
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 mb-1">
                <span className="font-mono text-xs text-accent">{t.year || "—"}</span>
                <span className="text-sm font-medium">{t.role}</span>
                <span className="text-xs text-muted-foreground">@ {t.org}</span>
              </div>
              <p className="text-sm text-muted-foreground">{t.blurb}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ConnectedPlatforms({ platforms }: { platforms: Platform[] }) {
  const icon = (n: string) =>
    n === "GitHub" ? (
      <Github className="size-4" />
    ) : n === "LinkedIn" ? (
      <Linkedin className="size-4" />
    ) : n === "LeetCode" ? (
      <Code2 className="size-4" />
    ) : (
      <Trophy className="size-4" />
    );

  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-6">
        Connected Platforms
      </h3>
      {platforms.length === 0 ? (
        <EmptyState message="No public profiles were found in this resume." />
      ) : (
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
                <div className="text-xs text-muted-foreground truncate">
                  {p.handle || p.stat || "—"}
                </div>
              </div>
              <ArrowUpRight className="size-4 text-muted-foreground group-hover:text-accent transition-colors" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function SearchResults({
  view,
  query,
}: {
  view: DashboardView;
  query: string;
}) {
  const term = query.trim().toLowerCase();

  const items: Array<{ kind: string; title: string; detail: string; ask: string }> = [];

  const push = (kind: string, title: string, detail: string, ask: string) => {
    if (`${title} ${detail}`.toLowerCase().includes(term)) {
      items.push({ kind, title, detail, ask });
    }
  };

  push(
    "Candidate",
    view.candidate.name,
    `${view.candidate.title} · ${view.candidate.summary}`,
    `Give me a concise overview of ${view.candidate.name}.`
  );

  for (const skill of view.skills) {
    push(
      "Skill",
      skill.name,
      `${skill.group} · proficiency ${skill.level}/100`,
      `How strong is ${view.candidate.name} in ${skill.name}, and what evidence supports that?`
    );
  }

  for (const project of view.projects) {
    push(
      "Project",
      project.name,
      `${project.tagline} ${project.tech.join(", ")}`,
      `Walk me through the ${project.name} project: architecture, decisions and impact.`
    );
  }

  for (const item of view.timeline) {
    push(
      "Experience",
      `${item.role} at ${item.org}`,
      `${item.year} · ${item.blurb}`,
      `What did ${view.candidate.name} do as ${item.role} at ${item.org}?`
    );
  }

  for (const platform of view.platforms) {
    push(
      "Platform",
      platform.name,
      platform.handle || platform.stat,
      `What does ${view.candidate.name}'s ${platform.name} profile show?`
    );
  }

  for (const fit of view.recruiterInsights.roleFits) {
    push(
      "Role fit",
      fit.role,
      `${fit.score}% · ${fit.verdict}`,
      `Why is ${view.candidate.name} a ${fit.verdict.toLowerCase()} for ${fit.role}?`
    );
  }

  const shown = items.slice(0, 10);

  return (
    <div className="rounded-xl border border-accent/25 bg-panel p-5">
      <div className="flex items-center gap-2 mb-4">
        <Search className="size-4 text-accent" />
        <span className="text-[10px] font-mono uppercase tracking-widest text-accent">
          Search results
        </span>
        <span className="ml-auto text-[10px] font-mono text-muted-foreground">
          {items.length} match{items.length === 1 ? "" : "es"}
        </span>
      </div>

      {shown.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nothing in this profile matches “{query}”. Try a skill, project or role.
        </p>
      ) : (
        <div className="space-y-2">
          {shown.map((item) => (
            <Link
              key={`${item.kind}-${item.title}-${item.detail}`}
              to="/chat"
              search={{ prompt: item.ask }}
              className="flex items-start gap-3 rounded-lg border border-border bg-background/40 p-3 hover:border-accent/40 transition-colors"
            >
              <span className="mt-0.5 shrink-0 px-1.5 py-0.5 rounded border border-accent/25 bg-accent/10 text-[9px] font-mono uppercase tracking-wider text-accent">
                {item.kind}
              </span>
              <span className="min-w-0">
                <span className="block text-sm font-medium truncate">
                  {item.title}
                </span>
                <span className="block text-xs text-muted-foreground line-clamp-2">
                  {item.detail}
                </span>
              </span>
              <ArrowUpRight className="size-4 text-muted-foreground shrink-0 ml-auto" />
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function GithubPanel({ github }: { github: GithubActivity }) {
  return (
    <div className="rounded-xl border border-border bg-panel p-6">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          {github.user.avatar ? (
            <img
              src={github.user.avatar}
              alt={github.user.name}
              className="size-10 rounded-full border border-border object-cover"
            />
          ) : (
            <div className="size-10 rounded-full bg-stone-800 flex items-center justify-center">
              <Github className="size-4" />
            </div>
          )}
          <div>
            <h3 className="text-sm font-semibold">{github.user.name}</h3>
            <a
              href={github.user.url}
              target="_blank"
              rel="noreferrer"
              className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline"
            >
              @{github.username}
            </a>
          </div>
        </div>
        <a
          href={github.user.url}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors"
        >
          <Github className="size-3" /> View GitHub
        </a>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
        {[
          ["Repos", String(github.stats.publicRepos)],
          ["Stars", String(github.stats.totalStars)],
          ["Followers", String(github.stats.followers)],
          ["Commits (90d)", String(github.stats.commitsLast90Days)],
          ["Languages", String(github.languages.length)],
        ].map(([label, value]) => (
          <div key={label} className="rounded-lg border border-border p-3">
            <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
              {label}
            </div>
            <div className="text-lg font-semibold">{value}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Top repositories
          </div>
          <div className="space-y-2">
            {github.repos.length === 0 && (
              <p className="text-xs text-muted-foreground">No public repositories found.</p>
            )}
            {github.repos.map((repo) => (
              <a
                key={repo.name}
                href={repo.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-start gap-3 rounded-lg border border-border p-3 hover:border-accent/40 transition-colors"
              >
                <div className="min-w-0 flex-1">
                  <div className="text-sm font-medium truncate">{repo.name}</div>
                  <div className="text-xs text-muted-foreground line-clamp-1">
                    {repo.description || repo.language || "No description"}
                  </div>
                </div>
                <div className="flex items-center gap-3 text-[10px] font-mono text-muted-foreground shrink-0">
                  <span className="inline-flex items-center gap-1">
                    <Star className="size-3" />
                    {repo.stars}
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <GitFork className="size-3" />
                    {repo.forks}
                  </span>
                </div>
              </a>
            ))}
          </div>
        </div>

        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Languages
          </div>
          <div className="flex flex-wrap gap-2">
            {github.languages.map((language) => (
              <span
                key={language.name}
                className="px-2.5 py-1 rounded-full border border-border bg-background/40 text-xs"
              >
                {language.name}
                <span className="ml-1.5 font-mono text-[10px] text-accent">
                  {language.count}
                </span>
              </span>
            ))}
          </div>
          {github.user.bio && (
            <p className="mt-5 text-sm text-muted-foreground leading-relaxed">
              {github.user.bio}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="h-full min-h-32 flex items-center justify-center text-center px-6">
      <p className="text-xs text-muted-foreground/70 max-w-xs leading-relaxed">
        {message}
      </p>
    </div>
  );
}

function clampPercent(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.max(0, Math.min(100, value));
}

function formatScore(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}
