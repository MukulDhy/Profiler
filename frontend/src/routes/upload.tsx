import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { motion, AnimatePresence } from "framer-motion";
import { useCallback, useEffect, useRef, useState } from "react";
import { UploadCloud, FileText, Check, AlertCircle, RotateCcw } from "lucide-react";
import { SiteNav } from "@/components/site/SiteNav";
import {
  pollResume,
  rememberResumeId,
  uploadResume,
  validateResumeFile,
} from "@/lib/api";

export const Route = createFileRoute("/upload")({
  head: () => ({
    meta: [
      { title: "Upload Resume — ProfileGPT" },
      {
        name: "description",
        content:
          "Upload your resume and watch it become an interactive AI profile.",
      },
    ],
  }),
  component: UploadPage,
});

const STAGES = [
  "Uploading resume…",
  "Extracting document structure…",
  "Generating AI insights…",
  "Building career graph…",
  "Deploying neural profile…",
];

type Phase = "idle" | "working" | "error";

function UploadPage() {
  const navigate = useNavigate();
  const [file, setFile] = useState<File | null>(null);
  const [stage, setStage] = useState(-1);
  const [phase, setPhase] = useState<Phase>("idle");
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  // Visual progress while the real pipeline runs. Completion is driven by the
  // backend status, never by this timer.
  useEffect(() => {
    if (phase !== "working") return;
    const timer = setInterval(() => {
      setStage((current) => Math.min(current + 1, STAGES.length - 2));
    }, 8_000);
    return () => clearInterval(timer);
  }, [phase]);

  useEffect(() => () => abortRef.current?.abort(), []);

  const startUpload = useCallback(
    async (selected: File) => {
      const validationError = validateResumeFile(selected);
      if (validationError) {
        setFile(selected);
        setError(validationError);
        setPhase("error");
        return;
      }

      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setFile(selected);
      setError(null);
      setPhase("working");
      setStage(0);

      try {
        const upload = await uploadResume(selected);
        rememberResumeId(upload.id);
        setStage(1);

        await pollResume(upload.id, {
          signal: controller.signal,
          onStatus: (response) => {
            if (response.processingStatus === "processing") {
              setStage((current) => Math.max(current, 1));
            }
          },
        });

        setStage(STAGES.length - 1);
        window.setTimeout(() => {
          navigate({ to: "/dashboard", search: { id: upload.id } });
        }, 700);
      } catch (caught) {
        if (controller.signal.aborted) return;
        setError(
          caught instanceof Error
            ? caught.message
            : "Something went wrong while analysing the resume."
        );
        setPhase("error");
      }
    },
    [navigate]
  );

  const onFiles = useCallback(
    (files: FileList | null) => {
      const selected = files?.[0];
      if (!selected) return;
      void startUpload(selected);
    },
    [startUpload]
  );

  const reset = () => {
    abortRef.current?.abort();
    abortRef.current = null;
    setFile(null);
    setError(null);
    setStage(-1);
    setPhase("idle");
  };

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
            Drop your resume.{" "}
            <span className="text-accent">Become queryable.</span>
          </h1>
          <p className="text-muted-foreground">
            PDF or DOCX · Max 5MB · Extracted with Docling, analysed by LLMs
          </p>
        </div>

        {phase === "idle" && (
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
            className={`relative block rounded-2xl border-2 border-dashed transition-all cursor-pointer overflow-hidden ${
              dragOver
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
              onChange={(e) => {
                onFiles(e.target.files);
                e.target.value = "";
              }}
            />
            <div className="relative p-16 text-center">
              <div className="size-16 rounded-2xl bg-accent/10 border border-accent/30 mx-auto mb-6 flex items-center justify-center">
                <UploadCloud className="size-7 text-accent" />
              </div>
              <h2 className="text-xl font-semibold mb-2">
                Drag & drop your resume
              </h2>
              <p className="text-sm text-muted-foreground mb-6">
                or click to browse
              </p>
              <span className="inline-flex items-center gap-2 px-5 py-2.5 bg-accent text-accent-foreground rounded-lg font-semibold text-sm">
                Choose file
              </span>
            </div>
          </label>
        )}

        {phase === "error" && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/5 p-8">
            <div className="flex items-start gap-3 mb-6">
              <AlertCircle className="size-5 text-red-400 mt-0.5 shrink-0" />
              <div>
                <h2 className="text-sm font-semibold mb-1">
                  We could not finish the analysis
                </h2>
                <p className="text-sm text-muted-foreground">{error}</p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              {file && (
                <button
                  onClick={() => void startUpload(file)}
                  className="inline-flex items-center gap-2 px-4 py-2 bg-accent text-accent-foreground rounded-md text-sm font-semibold hover:brightness-110 transition-all"
                >
                  <RotateCcw className="size-4" />
                  Retry
                </button>
              )}
              <button
                onClick={reset}
                className="px-4 py-2 border border-border rounded-md text-sm hover:border-accent/40 transition-colors"
              >
                Choose another file
              </button>
            </div>
            <p className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest mt-6">
              Tip: make sure the AI Analyser service is running on port 8000.
            </p>
          </div>
        )}

        {phase === "working" && (
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
                    className={`flex items-center gap-4 p-3 rounded-lg border ${
                      active
                        ? "border-accent/30 bg-accent/5"
                        : done
                          ? "border-border bg-white/[0.02]"
                          : "border-border opacity-40"
                    }`}
                  >
                    <div
                      className={`size-6 rounded-full border flex items-center justify-center ${
                        done
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
                    <span
                      className={`text-sm ${active ? "text-foreground" : "text-muted-foreground"}`}
                    >
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
