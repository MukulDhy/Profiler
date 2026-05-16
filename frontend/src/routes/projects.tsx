import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/layout/AppShell";
import { projects } from "@/data/mock";
import { ExternalLink, Github, MessageSquare } from "lucide-react";

export const Route = createFileRoute("/projects")({
  head: () => ({
    meta: [
      { title: "Project Intelligence — ProfileGPT" },
      { name: "description", content: "AI-analyzed showcase of the candidate's production projects." },
    ],
  }),
  component: () => (
    <AppShell>
      <Projects />
    </AppShell>
  ),
});

function Projects() {
  return (
    <div className="p-6 lg:p-10 max-w-[1400px] mx-auto">
      <div className="mb-10">
        <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
          Project Intelligence
        </div>
        <h1 className="text-3xl font-semibold tracking-tight mb-3">Production-grade work, analyzed.</h1>
        <p className="text-muted-foreground max-w-2xl">
          Every project deconstructed: architecture decisions, metrics, and AI-generated summaries.
        </p>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {projects.map((p) => (
          <div
            key={p.id}
            className="group rounded-xl border border-border bg-panel overflow-hidden hover:border-accent/30 transition-colors"
          >
            <div className="aspect-[16/8] bg-gradient-to-br from-accent/15 via-panel-2 to-background relative overflow-hidden border-b border-border">
              <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.04)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] bg-[size:24px_24px]" />
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-[10px] font-mono uppercase tracking-widest text-accent/60">
                  {p.name.toUpperCase()} · LIVE
                </span>
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-xl font-semibold mb-1">{p.name}</h3>
              <p className="text-sm text-muted-foreground mb-5">{p.tagline}</p>

              <div className="grid grid-cols-3 gap-3 mb-5">
                {Object.entries(p.metrics).map(([k, v]) => (
                  <div key={k} className="p-3 rounded-md border border-border text-center">
                    <div className="text-sm font-semibold">{v}</div>
                    <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-wider">
                      {k}
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap gap-1.5 mb-5">
                {p.tech.map((t) => (
                  <span
                    key={t}
                    className="px-2 py-0.5 text-[10px] font-mono uppercase tracking-wider border border-border rounded text-muted-foreground"
                  >
                    {t}
                  </span>
                ))}
              </div>

              <div className="p-3 rounded-lg bg-accent/5 border border-accent/15 mb-5">
                <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-1.5">
                  AI Summary
                </div>
                <p className="text-xs text-foreground/85 leading-relaxed">{p.summary}</p>
              </div>

              <div className="flex flex-wrap gap-2">
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors">
                  <ExternalLink className="size-3" /> View Demo
                </button>
                <button className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors">
                  <Github className="size-3" /> View Code
                </button>
                <Link
                  to="/chat"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:brightness-110 transition-all ml-auto"
                >
                  <MessageSquare className="size-3" /> Ask AI About It
                </Link>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
