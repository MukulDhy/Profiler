import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { ShareDialog } from "@/components/share/ShareDialog";
import {
  createNote,
  deleteNote,
  getLatestResumeProfile,
  listNotes,
  matchJob,
  revokeResumeShare,
  shareResume,
  ApiError,
} from "@/lib/api";
import { buildDashboardView } from "@/lib/view";
import type { JobMatch, Note, Sharing } from "@/lib/types";
import {
  CheckCircle2,
  MessageSquare,
  ThumbsUp,
  Briefcase,
  Share2,
  Sparkles,
  Loader2,
  AlertCircle,
  Target,
  Plus,
  Trash2,
  StickyNote,
} from "lucide-react";

export const Route = createFileRoute("/recruiter")({
  head: () => ({
    meta: [
      { title: "Recruiter View — ProfileGPT" },
      {
        name: "description",
        content:
          "Hiring recommendation, role-fit analysis, job-description matching and private notes.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Recruiter />
    </AppShell>
  ),
});

function Recruiter() {
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["latest-profile"],
    queryFn: ({ signal }) => getLatestResumeProfile(signal),
    enabled: typeof window !== "undefined",
    staleTime: 15_000,
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

  const resumeId = query.data?.upload?.id;
  const roleFits = view.recruiterInsights.roleFits;
  const [role, setRole] = useState(roleFits[0]);
  const [sharing, setSharing] = useState<Sharing | null>(null);
  const [shareOpen, setShareOpen] = useState(false);

  useEffect(() => {
    setSharing(query.data?.sharing ?? null);
  }, [query.data?.sharing]);

  useEffect(() => {
    if (roleFits.length > 0) setRole(roleFits[0]);
  }, [roleFits]);

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 mb-2">
            <div className="text-[10px] font-mono text-accent uppercase tracking-widest">
              Recruiter Dashboard
            </div>
            <span
              className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-widest ${
                view.isLive
                  ? "border-accent/30 bg-accent/10 text-accent"
                  : "border-border bg-panel text-muted-foreground"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${view.isLive ? "bg-accent" : "bg-muted-foreground"}`}
              />
              {view.isLive ? "Live analysis" : "Demo data"}
            </span>
          </div>
          <h1 className="text-3xl font-semibold tracking-tight">
            Hiring intelligence for {view.candidate.name}
          </h1>
        </div>
        <button
          onClick={() => setShareOpen(true)}
          disabled={!resumeId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
        >
          <Share2 className="size-4" />
          {sharing?.isPublic ? "Manage share" : "Share profile"}
        </button>
      </div>

      {query.isError && !query.data && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>
            Could not load the live profile. Showing demo data.{" "}
            {query.error instanceof Error ? query.error.message : ""}
          </span>
        </div>
      )}

      {/* Overview */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 rounded-xl border border-border bg-panel">
          <div className="flex items-start gap-4 mb-6">
            <div className="size-14 rounded-full bg-stone-800 flex items-center justify-center font-mono text-sm overflow-hidden">
              {query.data?.profile?.candidate?.initials || view.candidate.initials}
            </div>
            <div className="flex-1">
              <h2 className="text-xl font-semibold">{view.candidate.name}</h2>
              <p className="text-sm text-muted-foreground">
                {view.candidate.title} · {view.candidate.location} ·{" "}
                {view.candidate.experienceYears}+ years
              </p>
            </div>
            <span className="px-3 py-1 rounded-full bg-accent/10 text-accent border border-accent/30 text-[10px] font-mono uppercase tracking-widest">
              {role?.verdict || "Under review"}
            </span>
          </div>
          <p className="text-sm text-foreground/90 leading-relaxed mb-6">
            {view.candidate.recruiterImpression ||
              "No recruiter impression was generated for this resume."}
          </p>
          <div className="grid grid-cols-3 gap-3">
            {[
              ["ATS", `${view.candidate.atsScore}%`],
              ["Projects", String(view.projectCount)],
              ["Best fit", role ? `${role.score}%` : "—"],
            ].map(([key, value]) => (
              <div key={key} className="p-3 rounded-md border border-border">
                <div className="text-[10px] font-mono text-muted-foreground uppercase">
                  {key}
                </div>
                <div className="text-base font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 rounded-xl border border-accent/30 bg-accent/5">
          <ThumbsUp className="size-5 text-accent mb-3" />
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
            Hiring recommendation
          </div>
          <div className="text-2xl font-semibold mb-2">
            {role?.verdict || "Not enough signal"}
          </div>
          <p className="text-sm text-foreground/85 leading-relaxed">
            {role
              ? `Best evaluated as ${role.role} at ${role.score}% match. Use the interview questions below to validate depth.`
              : "Upload an analysed resume to generate a hiring recommendation."}
          </p>
        </div>
      </div>

      {/* Role fit selector */}
      <div className="p-6 rounded-xl border border-border bg-panel">
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
          Evaluate for role
        </h3>
        {roleFits.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No role fits were extracted from this resume.
          </p>
        ) : (
          <>
            <div className="flex flex-wrap gap-2 mb-6">
              {roleFits.map((fit) => (
                <button
                  key={fit.role}
                  onClick={() => setRole(fit)}
                  className={`inline-flex items-center gap-2 px-3 py-2 rounded-md text-xs font-medium border transition-colors ${
                    role?.role === fit.role
                      ? "bg-accent text-accent-foreground border-accent"
                      : "border-border hover:border-accent/40"
                  }`}
                >
                  <Briefcase className="size-3" />
                  {fit.role}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
              <div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                  Match score
                </div>
                <div className="text-5xl font-semibold tracking-tighter">
                  {role?.score ?? 0}
                  <span className="text-accent text-2xl">%</span>
                </div>
              </div>
              <div className="md:col-span-2">
                <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
                  Verdict
                </div>
                <div className="text-xl font-semibold mb-2">
                  {role?.verdict || "—"}
                </div>
                <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-accent"
                    style={{ width: `${role?.score ?? 0}%` }}
                  />
                </div>
              </div>
            </div>
          </>
        )}
      </div>

      {/* Job description matching */}
      <JobMatchPanel resumeId={resumeId} />

      {/* Strengths / Growth */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="p-6 rounded-xl border border-border bg-panel">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Strengths
          </h3>
          <ul className="space-y-2">
            {view.candidate.strengths.length === 0 && (
              <li className="text-sm text-muted-foreground">No strengths extracted.</li>
            )}
            {view.candidate.strengths.map((strength) => (
              <li key={strength} className="flex items-start gap-2 text-sm">
                <CheckCircle2 className="size-4 text-accent mt-0.5 shrink-0" />
                {strength}
              </li>
            ))}
          </ul>
        </div>
        <div className="p-6 rounded-xl border border-border bg-panel">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-4">
            Growth areas
          </h3>
          <ul className="space-y-2 text-sm text-muted-foreground">
            {view.candidate.weaknesses.length === 0 && (
              <li>No growth areas extracted.</li>
            )}
            {view.candidate.weaknesses.map((weakness) => (
              <li key={weakness} className="flex items-start gap-2">
                <span className="text-accent mt-0.5">•</span>
                {weakness}
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Interview questions */}
      <div className="p-6 rounded-xl border border-border bg-panel">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
            Generated interview questions
          </h3>
          <Link
            to="/chat"
            search={{ prompt: "What should I probe in an interview with this candidate?" }}
            className="text-[10px] font-mono uppercase tracking-widest text-accent hover:underline inline-flex items-center gap-1"
          >
            <MessageSquare className="size-3" /> Continue in chat
          </Link>
        </div>
        {view.recruiterInsights.interviewQuestions.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No interview questions were generated.
          </p>
        ) : (
          <ol className="space-y-3">
            {view.recruiterInsights.interviewQuestions.map((question, index) => (
              <li
                key={question}
                className="flex gap-3 p-3 rounded-md border border-border"
              >
                <span className="font-mono text-xs text-accent">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span className="text-sm">{question}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      <RecruiterNotes resumeId={resumeId} />

      <ShareDialog
        open={shareOpen}
        onClose={() => setShareOpen(false)}
        sharing={sharing}
        resumeId={resumeId}
        onShare={async (id) => {
          const next = await shareResume(id);
          setSharing(next);
          return next;
        }}
        onRevoke={async (id) => {
          const next = await revokeResumeShare(id);
          setSharing(next);
          return next;
        }}
      />
    </div>
  );
}

function JobMatchPanel({ resumeId }: { resumeId?: string }) {
  const [description, setDescription] = useState("");
  const [result, setResult] = useState<JobMatch | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = async () => {
    if (!resumeId || description.trim().length < 50) {
      setError("Paste a job description of at least 50 characters.");
      return;
    }

    setBusy(true);
    setError(null);
    try {
      setResult(await matchJob(resumeId, description.trim()));
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not evaluate this job description."
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <div className="flex items-center gap-2 mb-2">
        <Target className="size-4 text-accent" />
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Job description match
        </h3>
      </div>
      <p className="text-sm text-muted-foreground mb-4">
        Paste a role and get a calibrated fit score, keyword gaps, and concrete
        application advice.
      </p>

      <textarea
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        rows={5}
        placeholder="Paste the full job description here…"
        className="w-full bg-background border border-border rounded-lg p-3 text-sm resize-y focus:outline-none focus:border-accent transition-colors"
      />

      <div className="mt-3 flex flex-wrap items-center gap-3">
        <button
          onClick={() => void run()}
          disabled={busy || !resumeId}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-50"
        >
          {busy ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
          Evaluate match
        </button>
        <span className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          {description.trim().length} characters
        </span>
        {!resumeId && (
          <span className="text-xs text-muted-foreground">
            Upload a resume to enable matching.
          </span>
        )}
      </div>

      {error && (
        <div className="mt-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-5 border-t border-border pt-6">
          <div className="flex flex-wrap items-center gap-6">
            <div>
              <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest mb-1">
                Match score
              </div>
              <div className="text-4xl font-semibold tracking-tighter">
                {result.score}
                <span className="text-accent text-xl">%</span>
              </div>
            </div>
            <div className="flex-1 min-w-48">
              <div className="text-sm font-semibold mb-2">{result.verdict}</div>
              <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.max(0, Math.min(100, result.score))}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <KeywordList title="Matched keywords" items={result.matchedKeywords} tone="good" />
            <KeywordList title="Missing keywords" items={result.missingKeywords} tone="warn" />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <BulletList title="Strengths" items={result.strengths} />
            <BulletList title="Gaps" items={result.gaps} />
          </div>

          <BulletList title="Suggestions" items={result.suggestions} />
        </div>
      )}
    </div>
  );
}

function KeywordList({
  title,
  items,
  tone,
}: {
  title: string;
  items: string[];
  tone: "good" | "warn";
}) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {items.length === 0 && (
          <span className="text-xs text-muted-foreground">None</span>
        )}
        {items.map((item) => (
          <span
            key={item}
            className={`px-2 py-0.5 rounded border text-[10px] font-mono uppercase tracking-wider ${
              tone === "good"
                ? "border-accent/25 bg-accent/10 text-accent"
                : "border-amber-500/30 bg-amber-500/10 text-amber-300"
            }`}
          >
            {item}
          </span>
        ))}
      </div>
    </div>
  );
}

function BulletList({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-2">
        {title}
      </div>
      <ul className="space-y-1.5 text-sm text-muted-foreground">
        {items.length === 0 && <li>None</li>}
        {items.map((item) => (
          <li key={item} className="flex gap-2">
            <span className="text-accent mt-0.5">•</span>
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

function RecruiterNotes({ resumeId }: { resumeId?: string }) {
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const notesQuery = useQuery({
    queryKey: ["notes", resumeId ?? "none"],
    queryFn: () => listNotes(resumeId as string),
    enabled: typeof window !== "undefined" && Boolean(resumeId),
    staleTime: 10_000,
  });

  const notes: Note[] = notesQuery.data ?? [];

  const add = async () => {
    if (!resumeId || !body.trim()) return;
    setBusy(true);
    setError(null);
    try {
      await createNote({ resumeId, body: body.trim() });
      setBody("");
      await queryClient.invalidateQueries({ queryKey: ["notes", resumeId] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not save note.");
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    try {
      await deleteNote(id);
      await queryClient.invalidateQueries({ queryKey: ["notes", resumeId] });
    } catch (caught) {
      setError(caught instanceof ApiError ? caught.message : "Could not delete note.");
    }
  };

  return (
    <div className="p-6 rounded-xl border border-border bg-panel">
      <div className="flex items-center gap-2 mb-4">
        <StickyNote className="size-4 text-accent" />
        <h3 className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
          Private recruiter notes
        </h3>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div>
          <textarea
            value={body}
            onChange={(event) => setBody(event.target.value)}
            rows={4}
            placeholder="What stood out? What needs validation?"
            className="w-full bg-background border border-border rounded-lg p-3 text-sm resize-none focus:outline-none focus:border-accent transition-colors"
          />
          <button
            onClick={() => void add()}
            disabled={busy || !body.trim() || !resumeId}
            className="mt-3 inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:brightness-110 disabled:opacity-40"
          >
            {busy ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />}
            Save note
          </button>
          {error && <p className="mt-2 text-xs text-red-300">{error}</p>}
        </div>

        <div className="space-y-2 max-h-64 overflow-y-auto scrollbar-thin">
          {notes.length === 0 && (
            <p className="text-sm text-muted-foreground">
              No notes yet. Notes are private to your account and persist across sessions.
            </p>
          )}
          {notes.map((note) => (
            <div key={note.id} className="group rounded-lg border border-border p-3">
              <p className="text-sm text-foreground/90 whitespace-pre-wrap leading-relaxed">
                {note.body}
              </p>
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[10px] font-mono text-muted-foreground">
                  {new Date(note.createdAt).toLocaleString()}
                </span>
                <button
                  onClick={() => void remove(note.id)}
                  className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-300 transition-opacity"
                  aria-label="Delete note"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
