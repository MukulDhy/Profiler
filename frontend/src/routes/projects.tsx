import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { AppShell } from "@/components/layout/AppShell";
import { projects as mockProjects } from "@/data/mock";
import { getLatestResumeProfile } from "@/lib/api";
import type { Project } from "@/lib/types";
import {
  ExternalLink,
  Github,
  MessageSquare,
  Loader2,
  AlertCircle,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Project Intelligence — ProfileGPT" },
      {
        name: "description",
        content:
          "AI-analysed showcase of a candidate's production projects, architecture decisions and metrics.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <Projects />
    </AppShell>
  ),
});

function linkLabel(key: string): string {
  if (/github|code|repo/i.test(key)) return "View Code";
  if (/demo|live|site|url/i.test(key)) return "View Demo";
  return key;
}

function linkIcon(key: string) {
  return /github|code|repo/i.test(key) ? Github : ExternalLink;
}

function Projects() {
  const query = useQuery({
    queryKey: ["latest-profile"],
    queryFn: ({ signal }) => getLatestResumeProfile(signal),
    enabled: typeof window !== "undefined",
    staleTime: 15_000,
  });

  const liveProjects = query.data?.profile?.projects ?? [];
  const items: Project[] =
    liveProjects.length > 0
      ? liveProjects
      : (mockProjects as unknown as Project[]);
  const isLive = liveProjects.length > 0;

  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <div className="flex items-center gap-3 mb-2">
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest">
            Project Intelligence
          </div>
          <span
            className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-widest ${
              isLive
                ? "border-accent/30 bg-accent/10 text-accent"
                : "border-border bg-panel text-muted-foreground"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${isLive ? "bg-accent" : "bg-muted-foreground"}`}
            />
            {isLive ? "Live analysis" : "Demo data"}
          </span>
          {query.isPending && <Loader2 className="size-3 text-accent animate-spin" />}
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">
          Production-grade work, analysed.
        </h1>
        <p className="text-muted-foreground max-w-2xl">
          Every project deconstructed: architecture decisions, metrics, and
          AI-generated summaries grounded in the resume.
        </p>
      </div>

      {query.isError && !query.data && (
        <div className="mb-6 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>
            Could not load live projects ({query.error instanceof Error ? query.error.message : "unknown error"}).
            Showing demo data instead.
          </span>
        </div>
      )}

      {items.length === 0 ? (
        <div className="rounded-xl border border-border bg-panel p-10 text-center">
          <Sparkles className="size-6 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No projects extracted yet</h2>
          <p className="text-sm text-muted-foreground mb-5">
            Upload a resume with project details and the analyser will build this page.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold"
          >
            Upload resume
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {items.map((project, index) => {
            const metrics = Object.entries(project.metrics ?? {});
            const links = Object.entries(project.links ?? {}).filter(
              ([, value]) => Boolean(value)
            );

            return (
              <div
                key={project.id || `${project.name}-${index}`}
                className="group rounded-xl border border-border bg-panel overflow-hidden hover:border-accent/30 transition-colors flex flex-col"
              >
                <div className="aspect-[16/8] bg-gradient-to-br from-accent/15 via-panel-2 to-background relative overflow-hidden border-b border-border">
                  <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
                  <div className="absolute inset-0 flex items-center justify-center px-6 text-center">
                    <span className="text-[10px] font-mono uppercase tracking-widest text-accent/70">
                      {project.name}
                      {project.tech.length > 0 ? ` · ${project.tech.slice(0, 3).join(" / ")}` : ""}
                    </span>
                  </div>
                </div>

                <div className="p-6 flex flex-col flex-1">
                  <h3 className="text-xl font-semibold mb-1">{project.name}</h3>
                  <p className="text-sm text-muted-foreground mb-5">
                    {project.tagline || "No tagline extracted."}
                  </p>

                  {metrics.length > 0 && (
                    <div className="grid grid-cols-3 gap-3 mb-5">
                      {metrics.slice(0, 3).map(([key, value]) => (
                        <div
                          key={key}
                          className="p-3 rounded-md border border-border text-center"
                        >
                          <div className="text-sm font-semibold truncate">{value}</div>
                          <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider truncate">
                            {key}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  <div className="flex flex-wrap gap-1.5 mb-5">
                    {project.tech.map((tech) => (
                      <span
                        key={tech}
                        className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border border-border rounded text-muted-foreground"
                      >
                        {tech}
                      </span>
                    ))}
                  </div>

                  <div className="p-3 rounded-lg bg-accent/5 border border-accent/15 mb-5">
                    <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-1.5">
                      AI Summary
                    </div>
                    <p className="text-xs text-foreground/85 leading-relaxed">
                      {project.summary || "No summary was generated for this project."}
                    </p>
                  </div>

                  <div className="mt-auto flex flex-wrap gap-2">
                    {links.map(([key, value]) => {
                      const Icon = linkIcon(key);
                      return (
                        <a
                          key={key}
                          href={value}
                          target="_blank"
                          rel="noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors"
                        >
                          <Icon className="size-3" />
                          {linkLabel(key)}
                        </a>
                      );
                    })}
                    <Link
                      to="/chat"
                      search={{
                        prompt: `Walk me through the ${project.name} project: architecture, key decisions, and measurable impact.`,
                      }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:brightness-110 transition-all ml-auto"
                    >
                      <MessageSquare className="size-3" /> Ask AI About It
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
