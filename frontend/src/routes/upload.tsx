import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useState } from "react";
import { UploadCloud, FileText, Check } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Resume — ProfileGPT" },
      { name: "description", content: "Upload your resume and watch it become an interactive AI profile." },
    ],
  }),
  component: UploadPage,
});

const STAGES = [
  "Uploading the Resume to the Server…",
  "Parsing the Document…",
  "Analyzing the Content…",
  "Analyzing resume…",
  "Extracting skills…",
  "Generating AI insights…",
  "Building career graph…",
  "Deploying neural profile…",
];

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState(-1);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (stage < 0 || stage >= STAGES.length) return;
    const t = setTimeout(() => {
      if (stage === STAGES.length - 1) {
        navigate({ to: "/dashboard" });
      } else {
        setStage(stage + 1);
      }
    }, 1100);
    return () => clearTimeout(t);
  }, [stage, navigate]);

  const onFiles = useCallback((f: FileList | null) => {
    if (!f || !f[0]) return;
    setFile(f[0]);
    setStage(0);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <SiteNav />
      <div className="pt-32 pb-20 px-6 max-w-3xl mx-auto">
        <div className="text-center mb-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-accent/30 bg-accent/10 text-accent text-[11px] font-mono uppercase tracking-widest mb-6">
            <span className="size-1.5 rounded-full bg-accent animate-pulse" />
            Ingestion Engine
          </div>
          <h1 className="text-4xl md:text-5xl font-semibold tracking-tight mb-4">
            Drop your resume. <span className="text-accent">Become queryable.</span>
          </h1>
          <p className="text-muted-foreground">PDF or DOCX · Max 10MB · Encrypted at rest</p>
        </div>

        {stage < 0 ? (
          <label
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              onFiles(e.dataTransfer.files);
            }}
            className={`relative block rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${dragOver
              ? "border-accent bg-accent/5"
              : "border-border bg-panel hover:border-accent/50"
              }`}
          >
            <div className="absolute inset-0 bg-accent/5 opacity-0 hover:opacity-100 transition-opacity pointer-events-none" />
            <div className="absolute -inset-20 bg-accent/20 blur-3xl opacity-30 animate-pulse-glow pointer-events-none" />
            <input
              type="file"
              accept=".pdf,.docx"
              className="sr-only"
              onChange={(e) => onFiles(e.target.files)}
            />
            <div className="relative p-16 text-center">
              <div className="size-16 rounded-2xl bg-accent/10 border border-accent/30 mx-auto mb-6 flex items-center justify-center">
                <UploadCloud className="size-7 text-accent" />
              </div>
              <h2 className="text-xl font-semibold mb-2">Drag & drop your resume</h2>
              <p className="text-sm text-muted-foreground mb-6">or click to browse</p>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg font-semibold text-sm">
                Choose file
              </span>
            </div>
          </label>
        ) : (
          <div className="rounded-2xl border border-border bg-panel p-10">
            <div className="flex items-center gap-3 mb-8 pb-6 border-b border-border">
              <FileText className="size-5 text-accent" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium truncate">{file?.name}</div>
                <div className="text-[10px] font-mono text-muted-foreground uppercase tracking-widest">
                  {(file?.size ?? 0).toLocaleString()} bytes · parsing
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {STAGES.map((label, i) => {
                const done = i < stage;
                const active = i === stage;
                return (
                  <motion.div
                    key={label}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={`flex items-center gap-4 p-3 rounded-lg border ${active
                      ? "border-accent/30 bg-accent/5"
                      : done
                        ? "border-border bg-white/[0.02]"
                        : "border-border opacity-40"
                      }`}
                  >
                    <div
                      className={`size-6 rounded-full border flex items-center justify-center ${done
                        ? "bg-accent border-accent text-accent-foreground"
                        : active
                          ? "border-accent text-accent"
                          : "border-border"
                        }`}
                    >
                      {done ? (
                        <Check className="size-3" />
                      ) : active ? (
                        <span className="size-2 rounded-full bg-accent animate-pulse" />
                      ) : null}
                    </div>
                    <span className={`text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}>
                      {label}
                    </span>
                    {active && (
                      <AnimatePresence>
                        <motion.span
                          initial={{ opacity: 0 }}
                          animate={{ opacity: 1 }}
                          className="ml-auto text-[10px] font-mono text-accent uppercase tracking-widest"
                        >
                          Running…
                        </motion.span>
                      </AnimatePresence>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
