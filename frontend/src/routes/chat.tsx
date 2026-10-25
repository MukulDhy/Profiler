import { createFileRoute, Link } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import {
  Send,
  Plus,
  Sparkles,
  MessageSquare,
  Trash2,
  Loader2,
  FileText,
  StickyNote,
  AlertCircle,
  ChevronDown,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import {
  ApiError,
  createConversation,
  createNote,
  deleteConversation,
  deleteNote,
  getConversation,
  getLatestResumeProfile,
  listConversations,
  listNotes,
  listResumes,
  sendChatMessage,
} from "@/lib/api";
import type {
  ChatMessageRecord,
  ConversationSummary,
  Note,
} from "@/lib/types";

export const Route = createFileRoute("/chat")({
  validateSearch: (search: Record<string, unknown>): { prompt?: string } => ({
    prompt: typeof search.prompt === "string" ? search.prompt : undefined,
  }),
  head: () => ({
    meta: [
      { title: "AI Chat — ProfileGPT" },
      {
        name: "description",
        content:
          "Chat with a candidate's resume-grounded AI profile. Every answer is evidence-based.",
      },
    ],
  }),
  component: () => (
    <AppShell>
      <ChatPage />
    </AppShell>
  ),
});

const BASE_SUGGESTIONS = [
  "Summarise this candidate in 3 bullets",
  "What are their strongest technical skills?",
  "Which role are they the best fit for?",
  "What should I probe in an interview?",
];

function greeting(name?: string) {
  return `Hi — I'm the AI profile${name ? ` for **${name}**` : ""}. Ask anything about the candidate's experience, projects, skills, or fit for a role. I only answer from the resume and the structured analysis.`;
}

function ChatPage() {
  const { prompt } = Route.useSearch();
  const queryClient = useQueryClient();

  const resumeQuery = useQuery({
    queryKey: ["latest-profile"],
    queryFn: ({ signal }) => getLatestResumeProfile(signal),
    enabled: typeof window !== "undefined",
    staleTime: 15_000,
  });

  const resumesQuery = useQuery({
    queryKey: ["resumes", "chat"],
    queryFn: ({ signal }) => listResumes({ limit: 50 }, signal),
    enabled: typeof window !== "undefined",
    staleTime: 30_000,
  });

  const [resumeId, setResumeId] = useState<string | undefined>(undefined);

  useEffect(() => {
    if (resumeId) return;
    const fromLatest = resumeQuery.data?.upload?.id;
    if (fromLatest) {
      setResumeId(fromLatest);
      return;
    }
    const first = resumesQuery.data?.uploads?.[0]?.id;
    if (first) setResumeId(first);
  }, [resumeId, resumeQuery.data?.upload?.id, resumesQuery.data?.uploads]);

  const profile = resumeQuery.data?.profile ?? null;
  const profileReady = Boolean(profile);
  const candidateName = profile?.candidate?.name;

  const conversationsQuery = useQuery({
    queryKey: ["conversations", resumeId ?? "none"],
    queryFn: () => listConversations(resumeId),
    enabled: typeof window !== "undefined" && Boolean(resumeId),
    staleTime: 10_000,
  });

  const [activeId, setActiveId] = useState<string | undefined>(undefined);
  const [messages, setMessages] = useState<ChatMessageRecord[]>([]);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>(BASE_SUGGESTIONS);
  const scrollRef = useRef<HTMLDivElement>(null);
  const promptHandled = useRef(false);

  const conversationQuery = useQuery({
    queryKey: ["conversation", activeId ?? "none"],
    queryFn: () => getConversation(activeId as string),
    enabled: typeof window !== "undefined" && Boolean(activeId),
  });

  useEffect(() => {
    if (conversationQuery.data) {
      setMessages(conversationQuery.data.messages);
    }
  }, [conversationQuery.data]);

  useEffect(() => {
    setActiveId(undefined);
    setMessages([]);
    setError(null);
    setSuggestions(BASE_SUGGESTIONS);
  }, [resumeId]);

  useEffect(() => {
    scrollRef.current?.scrollTo({
      top: scrollRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  const conversations = conversationsQuery.data ?? [];

  const send = useCallback(
    async (text: string) => {
      const content = text.trim();
      if (!content || sending) return;
      if (!resumeId) {
        setError("Upload and analyse a resume before chatting.");
        return;
      }

      setError(null);
      setInput("");
      setSending(true);
      setMessages((current) => [...current, { role: "user", content }]);

      try {
        let conversationId = activeId;
        let createdId: string | undefined;
        if (!conversationId) {
          const conversation = await createConversation(resumeId);
          conversationId = conversation.id;
          createdId = conversation.id;
        }

        const result = await sendChatMessage(conversationId, content);
        setMessages((current) => [...current, result.message]);
        setSuggestions(result.suggestions?.length ? result.suggestions : BASE_SUGGESTIONS);
        if (createdId) setActiveId(createdId);
        await queryClient.invalidateQueries({ queryKey: ["conversations"] });
        await queryClient.invalidateQueries({
          queryKey: ["conversation", conversationId],
        });
      } catch (caught) {
        setError(
          caught instanceof ApiError
            ? caught.message
            : "The AI could not answer right now. Please try again."
        );
      } finally {
        setSending(false);
      }
    },
    [activeId, queryClient, resumeId, sending]
  );

  useEffect(() => {
    if (!prompt || promptHandled.current || !profileReady || !resumeId) return;
    promptHandled.current = true;
    void send(prompt);
  }, [prompt, profileReady, resumeId, send]);

  const startNew = () => {
    setActiveId(undefined);
    setMessages([]);
    setError(null);
    setSuggestions(BASE_SUGGESTIONS);
  };

  const removeConversation = async (id: string) => {
    try {
      await deleteConversation(id);
      if (id === activeId) startNew();
      await queryClient.invalidateQueries({ queryKey: ["conversations"] });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Could not delete that conversation."
      );
    }
  };

  const selectResume = (id: string) => {
    setResumeId(id);
    promptHandled.current = false;
  };

  const resumeOptions = useMemo(() => {
    const uploads = resumesQuery.data?.uploads ?? [];
    const completed = uploads.filter(
      (upload) => upload.processingStatus === "completed" || !upload.processingStatus
    );
    return completed.length > 0 ? completed : uploads;
  }, [resumesQuery.data?.uploads]);

  return (
    <div className="h-full flex flex-col lg:flex-row">
      {/* History sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-panel/40">
        <div className="p-3 space-y-2 border-b border-border">
          <button
            onClick={startNew}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:border-accent/40 text-sm transition-colors"
          >
            <Plus className="size-4 text-accent" />
            New conversation
          </button>
          {resumeOptions.length > 0 && (
            <label className="block">
              <span className="sr-only">Resume</span>
              <div className="relative">
                <select
                  value={resumeId ?? ""}
                  onChange={(event) => selectResume(event.target.value)}
                  className="w-full appearance-none bg-background border border-border rounded-md px-3 py-2 pr-8 text-xs focus:outline-none focus:border-accent"
                >
                  {resumeOptions.map((upload) => (
                    <option key={upload.id} value={upload.id}>
                      {upload.fileName}
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground pointer-events-none" />
              </div>
            </label>
          )}
        </div>

        <div className="px-3 py-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Recent
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
          {conversationsQuery.isPending && (
            <div className="flex items-center gap-2 px-3 py-2 text-xs text-muted-foreground">
              <Loader2 className="size-3 animate-spin" /> Loading…
            </div>
          )}
          {conversations.length === 0 && !conversationsQuery.isPending && (
            <p className="px-3 py-2 text-xs text-muted-foreground leading-relaxed">
              No conversations yet. Ask the first question.
            </p>
          )}
          {conversations.map((conversation) => (
            <ConversationRow
              key={conversation.id}
              conversation={conversation}
              active={conversation.id === activeId}
              onSelect={() => {
                setActiveId(conversation.id);
                setError(null);
              }}
              onDelete={() => void removeConversation(conversation.id)}
            />
          ))}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-background/80 backdrop-blur-md p-4 flex items-center gap-3">
          <div className="size-9 rounded-full bg-stone-800 flex items-center justify-center text-xs font-mono">
            {profile?.candidate?.initials || "PG"}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">
              {candidateName ? `Chat with ${candidateName}` : "Resume chat"}
            </div>
            <div className="text-[10px] font-mono text-accent uppercase tracking-widest flex items-center gap-1.5">
              <span
                className={`size-1.5 rounded-full ${
                  profileReady ? "bg-accent animate-pulse" : "bg-muted-foreground"
                }`}
              />
              {profileReady ? "Grounded on full resume" : "Waiting for an analysed resume"}
            </div>
          </div>
          {!profileReady && resumeQuery.isSuccess && (
            <Link
              to="/upload"
              className="ml-auto inline-flex items-center gap-2 px-3 py-1.5 rounded-md bg-accent text-accent-foreground text-xs font-semibold"
            >
              <FileText className="size-3" /> Upload resume
            </Link>
          )}
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="flex gap-3"
            >
              <div className="size-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                <Sparkles className="size-3.5" />
              </div>
              <div className="max-w-[78%] rounded-2xl rounded-tl-sm px-4 py-3 text-sm leading-relaxed bg-panel border border-border">
                <div className="prose prose-sm prose-invert max-w-none prose-strong:text-accent prose-p:my-0">
                  <ReactMarkdown>{greeting(candidateName)}</ReactMarkdown>
                </div>
              </div>
            </motion.div>

            {messages.map((message, index) => (
              <motion.div
                key={message.id ?? `${message.role}-${index}`}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${message.role === "user" ? "justify-end" : ""}`}
              >
                {message.role === "assistant" && (
                  <div className="size-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                    <Sparkles className="size-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    message.role === "user"
                      ? "bg-accent text-accent-foreground rounded-tr-sm"
                      : "bg-panel border border-border rounded-tl-sm"
                  }`}
                >
                  <div className="prose prose-sm prose-invert max-w-none prose-strong:text-accent prose-strong:font-semibold prose-p:my-0 prose-p:leading-relaxed">
                    <ReactMarkdown>{message.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}

            {sending && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="flex gap-3"
              >
                <div className="size-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                  <Sparkles className="size-3.5" />
                </div>
                <div className="bg-panel border border-border rounded-2xl rounded-tl-sm px-4 py-3 flex gap-1">
                  <span className="size-1.5 rounded-full bg-accent animate-bounce" />
                  <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:120ms]" />
                  <span className="size-1.5 rounded-full bg-accent animate-bounce [animation-delay:240ms]" />
                </div>
              </motion.div>
            )}

            {error && (
              <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <span>{error}</span>
              </div>
            )}
          </div>
        </div>

        {messages.length === 0 && (
          <div className="max-w-3xl mx-auto px-6 pb-3 w-full">
            <div className="flex flex-wrap gap-2">
              {suggestions.map((suggestion) => (
                <button
                  key={suggestion}
                  onClick={() => void send(suggestion)}
                  disabled={!profileReady || sending}
                  className="px-3 py-1.5 text-xs rounded-full border border-border bg-panel hover:border-accent/40 hover:text-accent transition-colors disabled:opacity-40"
                >
                  {suggestion}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="border-t border-border bg-background/80 backdrop-blur-md p-4">
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void send(input);
            }}
            className="max-w-3xl mx-auto relative"
          >
            <input
              value={input}
              onChange={(event) => setInput(event.target.value)}
              placeholder={
                profileReady
                  ? `Ask anything about ${candidateName ?? "this candidate"}…`
                  : "Upload a resume to start chatting…"
              }
              disabled={!profileReady || sending}
              className="w-full bg-panel border border-border rounded-xl px-4 py-3.5 pr-12 text-sm focus:outline-none focus:border-accent transition-colors disabled:opacity-60"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center hover:brightness-110 disabled:opacity-30"
              disabled={!input.trim() || !profileReady || sending}
            >
              {sending ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Send className="size-4" />
              )}
            </button>
          </form>
          <p className="max-w-3xl mx-auto mt-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground text-center">
            Answers are grounded in the uploaded resume. Verify important claims.
          </p>
        </div>
      </div>

      {/* Context + notes panel */}
      <aside className="hidden xl:flex w-72 shrink-0 flex-col border-l border-border bg-panel/40 p-5 gap-6 overflow-y-auto">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Profile context
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-semibold">{candidateName ?? "No resume yet"}</div>
            <div className="text-muted-foreground text-xs">
              {profile?.candidate?.title ?? "Upload a resume to activate context"}
            </div>
            <div className="text-muted-foreground text-xs">
              {profile?.candidate?.location ?? ""}
            </div>
          </div>
        </div>

        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Quick stats
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["ATS", `${profile?.analysis?.atsScore ?? "—"}%`],
              ["Years", `${profile?.candidate?.experienceYears ?? "—"}+`],
              ["Projects", String(profile?.projects?.length ?? 0)],
              [
                "Fit",
                profile?.recruiterInsights?.roleFits?.length
                  ? `${Math.max(
                      ...profile.recruiterInsights.roleFits.map((fit) => fit.score)
                    )}%`
                  : "—",
              ],
            ].map(([label, value]) => (
              <div key={label} className="p-3 rounded-md border border-border bg-panel">
                <div className="text-[10px] font-mono text-muted-foreground uppercase">
                  {label}
                </div>
                <div className="text-sm font-semibold">{value}</div>
              </div>
            ))}
          </div>
        </div>

        <NotesPanel resumeId={resumeId} activeConversationId={activeId} />
      </aside>
    </div>
  );
}

function ConversationRow({
  conversation,
  active,
  onSelect,
  onDelete,
}: {
  conversation: ConversationSummary;
  active: boolean;
  onSelect: () => void;
  onDelete: () => void;
}) {
  return (
    <div
      className={`group flex items-center gap-1 rounded-md px-1 ${
        active ? "bg-accent-soft" : "hover:bg-panel"
      }`}
    >
      <button
        onClick={onSelect}
        className="flex-1 min-w-0 text-left px-2 py-2"
      >
        <div className="flex items-center gap-2 mb-0.5">
          <MessageSquare
            className={`size-3 shrink-0 ${active ? "text-accent" : "text-muted-foreground"}`}
          />
          <span className="text-sm truncate">{conversation.title}</span>
        </div>
        <span className="block text-[10px] font-mono text-muted-foreground truncate">
          {conversation.messageCount} messages
        </span>
      </button>
      <button
        onClick={onDelete}
        className="opacity-0 group-hover:opacity-100 size-7 rounded flex items-center justify-center text-muted-foreground hover:text-red-300 transition-opacity"
        aria-label="Delete conversation"
      >
        <Trash2 className="size-3.5" />
      </button>
    </div>
  );
}

function NotesPanel({
  resumeId,
  activeConversationId,
}: {
  resumeId?: string;
  activeConversationId?: string;
}) {
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
      await createNote({
        resumeId,
        body: body.trim(),
        conversationId: activeConversationId,
      });
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
    <div>
      <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
        <StickyNote className="size-3 text-accent" />
        Recruiter notes
      </div>

      <div className="space-y-2 mb-3 max-h-52 overflow-y-auto scrollbar-thin">
        {notes.length === 0 && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            Jot impressions while you chat. Notes are private to your account.
          </p>
        )}
        {notes.map((note) => (
          <div
            key={note.id}
            className="group rounded-md border border-border bg-panel p-2.5"
          >
            <p className="text-xs text-foreground/90 whitespace-pre-wrap leading-relaxed">
              {note.body}
            </p>
            <div className="mt-1.5 flex items-center justify-between">
              <span className="text-[9px] font-mono text-muted-foreground">
                {new Date(note.createdAt).toLocaleDateString()}
              </span>
              <button
                onClick={() => void remove(note.id)}
                className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-red-300"
                aria-label="Delete note"
              >
                <Trash2 className="size-3" />
              </button>
            </div>
          </div>
        ))}
      </div>

      <textarea
        value={body}
        onChange={(event) => setBody(event.target.value)}
        placeholder="Add a private note…"
        rows={3}
        className="w-full bg-panel border border-border rounded-md p-2.5 text-xs resize-none focus:outline-none focus:border-accent transition-colors"
      />
      <button
        onClick={() => void add()}
        disabled={busy || !body.trim() || !resumeId}
        className="mt-2 w-full inline-flex items-center justify-center gap-2 px-3 py-2 rounded-md bg-accent text-accent-foreground text-xs font-semibold hover:brightness-110 disabled:opacity-40"
      >
        {busy ? <Loader2 className="size-3 animate-spin" /> : <Plus className="size-3" />}
        Save note
      </button>
      {error && <p className="mt-2 text-[10px] text-red-300">{error}</p>}
    </div>
  );
}
