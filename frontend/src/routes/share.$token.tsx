import { useEffect, useMemo, useRef, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  AlertCircle,
  ArrowUpRight,
  Briefcase,
  Github,
  Loader2,
  Lock,
  MapPin,
  MessageSquare,
  Send,
  Sparkles,
  Trophy,
} from "lucide-react";
import { ApiError, getPublicProfile, publicChat } from "@/lib/api";
import type { ChatMessageRecord, PublicProfile } from "@/lib/types";

export const Route = createFileRoute("/share/$token")({
  head: () => ({
    meta: [
      { title: "Shared profile — ProfileGPT" },
      {
        name: "description",
        content:
          "A read-only AI profile shared with ProfileGPT. Ask questions grounded in the candidate's resume.",
      },
      { name: "robots", content: "noindex" },
    ],
  }),
  component: PublicProfilePage,
});

function PublicProfilePage() {
  const { token } = Route.useParams();

  const query = useQuery({
    queryKey: ["public-profile", token],
    queryFn: () => getPublicProfile(token),
    enabled: typeof window !== "undefined" && Boolean(token),
    retry: false,
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between gap-4">
          <Link to="/" className="flex items-center gap-2">
            <div className="size-6 bg-accent rounded-sm flex items-center justify-center">
              <div className="size-2 bg-background rotate-45" />
            </div>
            <span className="font-semibold tracking-tight">ProfileGPT</span>
          </Link>
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Lock className="size-3" />
            Read-only shared profile
          </div>
        </div>
      </header>

      {query.isPending && (
        <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="size-6 text-accent animate-spin" />
          <p className="text-xs font-mono uppercase tracking-widest text-muted-foreground">
            Loading shared profile
          </p>
        </div>
      )}

      {query.isError && (
        <div className="min-h-[60vh] flex items-center justify-center px-6">
          <div className="max-w-md w-full rounded-2xl border border-border bg-panel p-8 text-center">
            <AlertCircle className="size-7 text-accent mx-auto mb-4" />
            <h1 className="text-xl font-semibold mb-2">This link is unavailable</h1>
            <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
              {query.error instanceof ApiError
                ? query.error.message
                : "The profile may have been unshared or the link is invalid."}
            </p>
            <Link
              to="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold"
            >
              Go to ProfileGPT
              <ArrowUpRight className="size-4" />
            </Link>
          </div>
        </div>
      )}

      {query.data && <SharedProfile data={query.data} token={token} />}
    </div>
  );
}

function initials(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "PG"
  );
}

function SharedProfile({
  data,
  token,
}: {
  data: PublicProfile;
  token: string;
}) {
  const { profile, owner } = data;
  const candidate = profile.candidate;
  const analysis = profile.analysis;
  const projects = profile.projects ?? [];
  const skills = profile.skills ?? [];
  const timeline = profile.timeline ?? [];
  const roleFits = profile.recruiterInsights?.roleFits ?? [];

  return (
    <main className="max-w-6xl mx-auto px-6 py-10 space-y-8">
      {/* Hero */}
      <section className="rounded-2xl border border-border bg-panel p-6 lg:p-8 relative overflow-hidden">
        <div className="absolute -top-24 -right-16 size-64 bg-accent/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative flex flex-wrap items-start gap-5">
          {owner.avatar ? (
            <img
              src={owner.avatar}
              alt={owner.name}
              className="size-16 rounded-full object-cover border border-border"
            />
          ) : (
            <div className="size-16 rounded-full bg-stone-800 border border-border flex items-center justify-center font-mono text-sm">
              {initials(owner.name || candidate.name)}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2 mb-1">
              <h1 className="text-2xl font-semibold tracking-tight">
                {candidate.name || owner.name}
              </h1>
              {analysis?.atsScore !== undefined && (
                <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border border-accent/30 bg-accent/10 text-[9px] font-mono uppercase tracking-widest text-accent">
                  <Sparkles className="size-2.5" />
                  ATS {Math.round(analysis.atsScore)}%
                </span>
              )}
            </div>
            <p className="text-sm text-muted-foreground">
              {candidate.title || "Professional"}
              {candidate.experienceYears
                ? ` · ${candidate.experienceYears}+ years experience`
                : ""}
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {owner.location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3" />
                  {owner.location}
                </span>
              )}
              {owner.githubUsername && (
                <a
                  href={`https://github.com/${owner.githubUsername}`}
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-accent hover:underline"
                >
                  <Github className="size-3" />@{owner.githubUsername}
                </a>
              )}
            </div>
          </div>
        </div>

        {(owner.bio || candidate.summary) && (
          <p className="relative mt-6 text-sm text-foreground/90 leading-relaxed max-w-3xl">
            {owner.bio || candidate.summary}
          </p>
        )}

        {roleFits.length > 0 && (
          <div className="relative mt-6 flex flex-wrap gap-2">
            {roleFits.slice(0, 4).map((fit) => (
              <span
                key={fit.role}
                className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full border border-border bg-background/50 text-xs"
              >
                <Briefcase className="size-3 text-accent" />
                {fit.role}
                <span className="font-mono text-[10px] text-accent">
                  {fit.score}%
                </span>
              </span>
            ))}
          </div>
        )}
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
        <div className="lg:col-span-3 space-y-8">
          {analysis && (
            <section className="rounded-xl border border-border bg-panel p-6">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
                AI assessment
              </h2>
              {analysis.recruiterImpression && (
                <p className="text-sm text-foreground/90 leading-relaxed mb-5">
                  {analysis.recruiterImpression}
                </p>
              )}
              <div className="grid grid-cols-3 gap-3">
                {[
                  ["Overall", `${Math.round(analysis.score ?? 0)}%`],
                  ["ATS", `${Math.round(analysis.atsScore ?? 0)}%`],
                  [
                    "Keywords",
                    `${analysis.keywordMatch?.matched ?? 0}/${
                      analysis.keywordMatch?.total ?? 0
                    }`,
                  ],
                ].map(([label, value]) => (
                  <div key={label} className="rounded-lg border border-border p-3">
                    <div className="text-[10px] font-mono uppercase text-muted-foreground">
                      {label}
                    </div>
                    <div className="text-base font-semibold">{value}</div>
                  </div>
                ))}
              </div>
              {analysis.strengths?.length > 0 && (
                <ul className="mt-5 space-y-2">
                  {analysis.strengths.slice(0, 5).map((strength) => (
                    <li key={strength} className="flex items-start gap-2 text-sm">
                      <Trophy className="size-3.5 text-accent mt-0.5 shrink-0" />
                      {strength}
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {projects.length > 0 && (
            <section>
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Projects
              </h2>
              <div className="space-y-3">
                {projects.map((project) => (
                  <article
                    key={project.id || project.name}
                    className="rounded-xl border border-border bg-panel p-5"
                  >
                    <h3 className="text-base font-semibold mb-1">
                      {project.name}
                    </h3>
                    <p className="text-sm text-muted-foreground mb-3">
                      {project.tagline}
                    </p>
                    {project.summary && (
                      <p className="text-sm text-foreground/85 leading-relaxed mb-3">
                        {project.summary}
                      </p>
                    )}
                    <div className="flex flex-wrap gap-1.5">
                      {(project.tech ?? []).map((tech) => (
                        <span
                          key={tech}
                          className="px-2 py-0.5 rounded border border-border text-[10px] font-mono uppercase tracking-wider text-muted-foreground"
                        >
                          {tech}
                        </span>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {timeline.length > 0 && (
            <section className="rounded-xl border border-border bg-panel p-6">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Experience
              </h2>
              <div className="space-y-4">
                {timeline.map((item, index) => (
                  <div key={`${item.role}-${item.org}-${index}`} className="flex gap-3">
                    <div className="w-px bg-border relative shrink-0">
                      <span className="absolute -left-1 top-1 size-2 rounded-full bg-accent" />
                    </div>
                    <div className="pb-1">
                      <div className="text-sm font-medium">
                        {item.role}
                        {item.org ? ` · ${item.org}` : ""}
                      </div>
                      <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-1">
                        {item.year}
                      </div>
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {item.blurb}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {skills.length > 0 && (
            <section className="rounded-xl border border-border bg-panel p-6">
              <h2 className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-4">
                Skills
              </h2>
              <div className="space-y-3">
                {skills.map((skill) => (
                  <div key={skill.name}>
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span>{skill.name}</span>
                      <span className="font-mono text-[10px] text-muted-foreground">
                        {skill.level}/100
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div
                        className="h-full bg-accent"
                        style={{
                          width: `${Math.max(0, Math.min(100, skill.level))}%`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>

        <div className="lg:col-span-2">
          <PublicChat token={token} name={candidate.name || owner.name} />
        </div>
      </div>

      <footer className="border-t border-border pt-6 pb-4 flex flex-wrap items-center justify-between gap-3 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        <span>
          Shared via ProfileGPT · {data.resume.fileName} ·{" "}
          {new Date(data.sharedAt).toLocaleDateString()}
        </span>
        <Link to="/signup" className="text-accent hover:underline">
          Create your own profile
        </Link>
      </footer>
    </main>
  );
}

const DEFAULT_SUGGESTIONS = [
  "Summarise this candidate in 3 bullets",
  "What are their strongest skills?",
  "Which role fits them best?",
];

function PublicChat({ token, name }: { token: string; name: string }) {
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [suggestions, setSuggestions] = useState(DEFAULT_SUGGESTIONS);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const history = useMemo(
    () =>
      messages.map((message) => ({
        role: message.role,
        content: message.content,
      })),
    [messages]
  );

  const send = async (text: string) => {
    const question = text.trim();
    if (!question || sending) return;

    setError(null);
    setInput("");
    setSending(true);
    setMessages((current) => [...current, { role: "user", content: question }]);

    try {
      const result = await publicChat(token, question, history);
      setMessages((current) => [
        ...current,
        { role: "assistant", content: result.answer },
      ]);
      if (result.suggestions?.length) setSuggestions(result.suggestions);
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "The assistant is unavailable right now."
      );
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="lg:sticky lg:top-24 rounded-xl border border-border bg-panel flex flex-col h-[70vh] min-h-[420px]">
      <div className="p-4 border-b border-border flex items-center gap-3">
        <div className="size-9 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent">
          <Sparkles className="size-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold truncate">Ask about {name}</div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-accent flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            Grounded on the full resume
          </div>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 scrollbar-thin">
        {messages.length === 0 && (
          <div className="text-xs text-muted-foreground leading-relaxed">
            Ask anything about this candidate's experience, projects or fit for a
            role. Answers come only from their resume.
          </div>
        )}

        {messages.map((message, index) => (
          <motion.div
            key={message.id ?? `${message.role}-${index}`}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={`flex ${message.role === "user" ? "justify-end" : ""}`}
          >
            <div
              className={`max-w-[88%] rounded-xl px-3.5 py-2.5 text-sm leading-relaxed ${
                message.role === "user"
                  ? "bg-accent text-accent-foreground rounded-tr-sm"
                  : "bg-background border border-border rounded-tl-sm"
              }`}
            >
              {message.role === "assistant" ? (
                <div className="prose prose-sm prose-invert max-w-none prose-p:my-0 prose-p:leading-relaxed prose-strong:text-accent">
                  <ReactMarkdown>{message.content}</ReactMarkdown>
                </div>
              ) : (
                message.content
              )}
            </div>
          </motion.div>
        ))}

        {sending && (
          <div className="flex gap-1">
            <span className="size-1.5 rounded-full bg-accent animate-bounce" />
            <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:120ms]" />
            <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:240ms]" />
          </div>
        )}

        {error && (
          <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}
      </div>

      {messages.length === 0 && (
        <div className="px-4 pb-2 flex flex-wrap gap-2">
          {suggestions.map((suggestion) => (
            <button
              key={suggestion}
              onClick={() => void send(suggestion)}
              disabled={sending}
              className="px-2.5 py-1 text-[11px] rounded-full border border-border bg-background hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}

      <form
        onSubmit={(event) => {
          event.preventDefault();
          void send(input);
        }}
        className="p-3 border-t border-border"
      >
        <div className="relative">
          <input
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder="Ask a question…"
            disabled={sending}
            className="w-full bg-background border border-border rounded-lg pl-3 pr-11 py-2.5 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={!input.trim() || sending}
            className="absolute right-1.5 top-1/2 -translate-y-1/2 size-8 rounded-md bg-accent text-accent-foreground flex items-center justify-center disabled:opacity-30"
            aria-label="Send question"
          >
            {sending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Send className="size-4" />
            )}
          </button>
        </div>
        <p className="mt-2 text-[9px] font-mono uppercase tracking-widest text-muted-foreground text-center">
          <MessageSquare className="size-2.5 inline mr-1" />
          Rate-limited · verify important claims
        </p>
      </form>
    </div>
  );
}
