import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import ReactMarkdown from "react-markdown";
import { Send, Plus, Sparkles, MessageSquare } from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { candidate, chatHistory, mockAIReply, suggestedPrompts } from "@/data/mock";

export const Route = createFileRoute("/chat")({
  head: () => ({
    meta: [
      { title: "AI Chat — ProfileGPT" },
      { name: "description", content: "Chat with the candidate's neural profile." },
    ],
  }),
  component: () => (
    <AppShell>
      <ChatPage />
    </AppShell>
  ),
});

type Msg = { role: "user" | "ai"; content: string };

function ChatPage() {
  const [messages, setMessages] = useState<Msg[]>([
    { role: "ai", content: `Hi — I'm the AI profile for **${candidate.name}**. Ask anything about their experience, projects, or fit for a role.` },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  const send = (text: string) => {
    const q = text.trim();
    if (!q) return;
    setMessages((m) => [...m, { role: "user", content: q }]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      setMessages((m) => [...m, { role: "ai", content: mockAIReply(q) }]);
      setTyping(false);
    }, 900);
  };

  return (
    <div className="h-screen flex">
      {/* History sidebar */}
      <aside className="hidden lg:flex w-64 shrink-0 flex-col border-r border-border bg-panel/40">
        <button className="m-3 flex items-center gap-2 px-3 py-2 rounded-md border border-border hover:border-accent/40 text-sm transition-colors">
          <Plus className="size-4 text-accent" />
          New conversation
        </button>
        <div className="px-3 pb-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
          Recent
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-3 scrollbar-thin">
          {chatHistory.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2 rounded-md hover:bg-panel transition-colors group"
            >
              <div className="flex items-center gap-2 mb-0.5">
                <MessageSquare className="size-3 text-muted-foreground" />
                <span className="text-sm truncate">{c.title}</span>
              </div>
              <span className="text-[10px] font-mono text-muted-foreground">{c.date}</span>
            </button>
          ))}
        </div>
      </aside>

      {/* Chat column */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="border-b border-border bg-background/80 backdrop-blur-md p-4 flex items-center gap-3">
          <div className="size-9 rounded-full bg-stone-800 flex items-center justify-center text-xs font-mono">
            {candidate.initials}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate">Chat with {candidate.name}</div>
            <div className="text-[10px] font-mono text-accent uppercase tracking-widest flex items-center gap-1.5">
              <span className="size-1.5 rounded-full bg-accent animate-pulse" />
              Neural profile online
            </div>
          </div>
        </header>

        <div ref={scrollRef} className="flex-1 overflow-y-auto scrollbar-thin">
          <div className="max-w-3xl mx-auto px-6 py-8 space-y-6">
            {messages.map((m, i) => (
              <motion.div
                key={i}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`flex gap-3 ${m.role === "user" ? "justify-end" : ""}`}
              >
                {m.role === "ai" && (
                  <div className="size-7 rounded-md bg-accent/10 border border-accent/30 flex items-center justify-center text-accent shrink-0">
                    <Sparkles className="size-3.5" />
                  </div>
                )}
                <div
                  className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    m.role === "user"
                      ? "bg-accent text-accent-foreground rounded-tr-sm"
                      : "bg-panel border border-border rounded-tl-sm"
                  }`}
                >
                  <div className="prose prose-sm prose-invert max-w-none prose-strong:text-accent prose-strong:font-semibold prose-p:my-0 prose-p:leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </motion.div>
            ))}
            {typing && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3">
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
          </div>
        </div>

        {/* Suggested prompts */}
        {messages.length <= 1 && (
          <div className="max-w-3xl mx-auto px-6 pb-3 w-full">
            <div className="flex flex-wrap gap-2">
              {suggestedPrompts.map((p) => (
                <button
                  key={p}
                  onClick={() => send(p)}
                  className="px-3 py-1.5 text-xs rounded-full border border-border bg-panel hover:border-accent/40 hover:text-accent transition-colors"
                >
                  {p}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Input */}
        <div className="border-t border-border bg-background/80 backdrop-blur-md p-4">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              send(input);
            }}
            className="max-w-3xl mx-auto relative"
          >
            <input
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder={`Ask anything about ${candidate.name}…`}
              className="w-full bg-panel border border-border rounded-xl px-4 py-3.5 pr-12 text-sm focus:outline-none focus:border-accent transition-colors"
            />
            <button
              type="submit"
              className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg bg-accent text-accent-foreground flex items-center justify-center hover:brightness-110 disabled:opacity-30"
              disabled={!input.trim()}
            >
              <Send className="size-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Context panel */}
      <aside className="hidden xl:flex w-72 shrink-0 flex-col border-l border-border bg-panel/40 p-5 gap-6">
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Profile context
          </div>
          <div className="space-y-1 text-sm">
            <div className="font-semibold">{candidate.name}</div>
            <div className="text-muted-foreground text-xs">{candidate.title}</div>
            <div className="text-muted-foreground text-xs">{candidate.location}</div>
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Quick stats
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              ["ATS", `${candidate.atsScore}%`],
              ["Years", `${candidate.experienceYears}+`],
              ["Projects", "4"],
              ["Fit", "94%"],
            ].map(([k, v]) => (
              <div key={k} className="p-3 rounded-md border border-border bg-panel">
                <div className="text-[10px] font-mono text-muted-foreground uppercase">{k}</div>
                <div className="text-sm font-semibold">{v}</div>
              </div>
            ))}
          </div>
        </div>
        <div>
          <div className="text-[10px] font-mono uppercase tracking-widest text-muted-foreground mb-3">
            Recruiter notes
          </div>
          <textarea
            placeholder="Jot impressions during the chat…"
            className="w-full h-32 bg-panel border border-border rounded-md p-3 text-xs resize-none focus:outline-none focus:border-accent transition-colors"
          />
        </div>
      </aside>
    </div>
  );
}
