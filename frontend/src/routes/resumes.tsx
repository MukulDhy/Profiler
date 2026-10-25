import { useMemo, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  CalendarClock,
  FileText,
  Loader2,
  RefreshCw,
  Share2,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { ShareDialog } from "@/components/share/ShareDialog";
import {
  ApiError,
  deleteResume,
  listResumes,
  reanalyzeResume,
  revokeResumeShare,
  shareResume,
} from "@/lib/api";
import type { Sharing, UploadSummary } from "@/lib/types";

export const Route = createFileRoute("/resumes")({
  head: () => ({
    meta: [
      { title: "Resume history — ProfileGPT" },
      {
        name: "description",
        content:
          "Every resume you have analysed, with status, sharing controls and one-click re-analysis.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ResumesPage />
    </AppShell>
  ),
});

const PAGE_SIZE = 8;

function formatBytes(bytes?: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(value?: string): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

const STATUS_STYLES: Record<string, string> = {
  completed: "border-accent/30 bg-accent/10 text-accent",
  processing: "border-amber-500/30 bg-amber-500/10 text-amber-300",
  uploaded: "border-border bg-panel text-muted-foreground",
  failed: "border-red-500/30 bg-red-500/10 text-red-300",
};

function StatusPill({ status }: { status?: string }) {
  const key = status ?? "uploaded";
  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full border text-[9px] font-mono uppercase tracking-widest ${
        STATUS_STYLES[key] ?? STATUS_STYLES.uploaded
      }`}
    >
      <span
        className={`size-1.5 rounded-full ${
          key === "completed"
            ? "bg-accent"
            : key === "processing"
              ? "bg-amber-300 animate-pulse"
              : key === "failed"
                ? "bg-red-400"
                : "bg-muted-foreground"
        }`}
      />
      {key}
    </span>
  );
}

function ResumesPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [shareTarget, setShareTarget] = useState<{
    id: string;
    sharing: Sharing | null;
  } | null>(null);

  const query = useQuery({
    queryKey: ["resumes", page],
    queryFn: ({ signal }) => listResumes({ page, limit: PAGE_SIZE }, signal),
    enabled: typeof window !== "undefined",
    refetchInterval: (current) =>
      (current.state.data?.uploads ?? []).some(
        (upload) => upload.processingStatus === "processing"
      )
        ? 3000
        : false,
  });

  const uploads = useMemo(
    () => query.data?.uploads ?? [],
    [query.data?.uploads]
  );
  const pagination = query.data?.pagination;

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["resumes"] });
  };

  const reanalyze = async (upload: UploadSummary) => {
    setBusyId(upload.id);
    setError(null);
    setNotice(null);
    try {
      await reanalyzeResume(upload.id);
      setNotice(`Re-analysis started for ${upload.fileName}.`);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not start re-analysis."
      );
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (upload: UploadSummary) => {
    setBusyId(upload.id);
    setError(null);
    setNotice(null);
    try {
      await deleteResume(upload.id);
      setConfirmDelete(null);
      setNotice(`${upload.fileName} was deleted.`);
      if (uploads.length === 1 && page > 1) setPage((current) => current - 1);
      await refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiError ? caught.message : "Could not delete that resume."
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="p-6 lg:p-10 max-w-[1100px] mx-auto space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-mono text-accent uppercase tracking-widest mb-2">
            Resume history
          </div>
          <h1 className="text-3xl font-semibold tracking-tight mb-2">
            Every version, one place.
          </h1>
          <p className="text-muted-foreground max-w-2xl">
            Open any analysis, re-run the pipeline after edits, or share a
            read-only profile with a recruiter.
          </p>
        </div>
        <Link
          to="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold hover:brightness-110 transition-all"
        >
          <UploadCloud className="size-4" />
          Upload resume
        </Link>
      </div>

      {error && (
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}
      {notice && (
        <div className="rounded-lg border border-accent/30 bg-accent/5 p-3 text-xs text-accent">
          {notice}
        </div>
      )}

      {query.isPending && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground py-16 justify-center">
          <Loader2 className="size-4 animate-spin text-accent" />
          Loading your resumes…
        </div>
      )}

      {query.isError && !query.data && (
        <div className="rounded-xl border border-border bg-panel p-8 text-center">
          <AlertCircle className="size-6 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">Could not load resumes</h2>
          <p className="text-sm text-muted-foreground mb-5">
            {query.error instanceof Error ? query.error.message : "Unknown error."}
          </p>
          <button
            onClick={() => void query.refetch()}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold"
          >
            <RefreshCw className="size-4" /> Try again
          </button>
        </div>
      )}

      {query.isSuccess && uploads.length === 0 && (
        <div className="rounded-xl border border-border bg-panel p-12 text-center">
          <FileText className="size-7 text-accent mx-auto mb-3" />
          <h2 className="text-lg font-semibold mb-2">No resumes yet</h2>
          <p className="text-sm text-muted-foreground mb-5 max-w-md mx-auto">
            Upload a PDF or DOCX and ProfileGPT will turn it into a queryable
            profile with projects, skills and role-fit analysis.
          </p>
          <Link
            to="/upload"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-accent text-accent-foreground text-sm font-semibold"
          >
            <UploadCloud className="size-4" /> Upload your first resume
          </Link>
        </div>
      )}

      {uploads.length > 0 && (
        <div className="space-y-3">
          {uploads.map((upload) => {
            const isBusy = busyId === upload.id;
            const failed = upload.processingStatus === "failed";

            return (
              <div
                key={upload.id}
                className="rounded-xl border border-border bg-panel p-5"
              >
                <div className="flex flex-wrap items-start gap-4">
                  <div className="size-11 rounded-lg border border-border bg-background flex items-center justify-center shrink-0">
                    <FileText className="size-5 text-accent" />
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h2 className="text-sm font-semibold truncate max-w-full">
                        {upload.fileName}
                      </h2>
                      <StatusPill status={upload.processingStatus} />
                      {upload.sharing?.isPublic && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full border border-accent/25 bg-accent/10 text-[9px] font-mono uppercase tracking-widest text-accent">
                          <Share2 className="size-2.5" /> Public
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] font-mono text-muted-foreground">
                      <span className="inline-flex items-center gap-1">
                        <CalendarClock className="size-3" />
                        {formatDate(upload.createdAt)}
                      </span>
                      <span>{upload.fileType?.toUpperCase()}</span>
                      <span>{formatBytes(upload.fileSize)}</span>
                    </div>
                    {failed && upload.analysisMeta?.error && (
                      <p className="mt-2 text-xs text-red-300 line-clamp-2">
                        {upload.analysisMeta.error}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <Link
                      to="/dashboard"
                      search={{ id: upload.id }}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors"
                    >
                      <BarChart3 className="size-3.5" />
                      Open
                    </Link>

                    <button
                      onClick={() => void reanalyze(upload)}
                      disabled={isBusy || upload.processingStatus === "processing"}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors disabled:opacity-40"
                    >
                      {isBusy ? (
                        <Loader2 className="size-3.5 animate-spin" />
                      ) : (
                        <RefreshCw className="size-3.5" />
                      )}
                      Re-analyse
                    </button>

                    <button
                      onClick={() =>
                        setShareTarget({
                          id: upload.id,
                          sharing: upload.sharing ?? null,
                        })
                      }
                      disabled={upload.processingStatus !== "completed"}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs hover:border-accent/40 transition-colors disabled:opacity-40"
                    >
                      <Share2 className="size-3.5" />
                      Share
                    </button>

                    {confirmDelete === upload.id ? (
                      <span className="inline-flex items-center gap-1.5">
                        <button
                          onClick={() => void remove(upload)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-red-500/90 text-white text-xs font-semibold hover:bg-red-500 disabled:opacity-50"
                        >
                          {isBusy ? (
                            <Loader2 className="size-3.5 animate-spin" />
                          ) : (
                            <Trash2 className="size-3.5" />
                          )}
                          Confirm
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-2 py-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          Cancel
                        </button>
                      </span>
                    ) : (
                      <button
                        onClick={() => setConfirmDelete(upload.id)}
                        disabled={isBusy}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md border border-border text-xs text-muted-foreground hover:text-red-300 hover:border-red-500/30 transition-colors disabled:opacity-40"
                      >
                        <Trash2 className="size-3.5" />
                        Delete
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {pagination && pagination.totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border pt-4">
          <button
            onClick={() => setPage((current) => Math.max(1, current - 1))}
            disabled={!pagination.hasPrevPage}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs disabled:opacity-40"
          >
            <ArrowRight className="size-3.5 rotate-180" />
            Previous
          </button>
          <span className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">
            Page {pagination.page} of {pagination.totalPages}
          </span>
          <button
            onClick={() => setPage((current) => current + 1)}
            disabled={!pagination.hasNextPage}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-md border border-border text-xs disabled:opacity-40"
          >
            Next
            <ArrowRight className="size-3.5" />
          </button>
        </div>
      )}

      <ShareDialog
        open={Boolean(shareTarget)}
        onClose={() => setShareTarget(null)}
        sharing={shareTarget?.sharing ?? null}
        resumeId={shareTarget?.id}
        onShare={async (id) => {
          const next = await shareResume(id);
          setShareTarget((current) =>
            current ? { ...current, sharing: next } : current
          );
          await refresh();
          return next;
        }}
        onRevoke={async (id) => {
          const next = await revokeResumeShare(id);
          setShareTarget((current) =>
            current ? { ...current, sharing: next } : current
          );
          await refresh();
          return next;
        }}
      />
    </div>
  );
}
