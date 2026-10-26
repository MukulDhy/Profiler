import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AlertCircle, ArrowRight, CheckCircle2, Database, Loader2, Sparkles } from "lucide-react";
import {
  AuthCard,
  Field,
  inputClass,
  primaryButtonClass,
  secondaryButtonClass,
} from "@/components/auth/AuthCard";
import { ApiError, setupApi } from "@/lib/api";
import type { SetupStatus } from "@/lib/types";

export const Route = createFileRoute("/setup")({
  head: () => ({
    meta: [
      { title: "Set up ProfileGPT" },
      {
        name: "description",
        content:
          "Connect a MongoDB database and an AI provider to finish installing ProfileGPT.",
      },
    ],
  }),
  component: SetupPage,
});

const PROVIDERS = [
  {
    id: "openrouter",
    label: "OpenRouter",
    hint: "One key for many models. Free tiers available.",
    keysUrl: "https://openrouter.ai/keys",
  },
  {
    id: "google",
    label: "Google AI Studio",
    hint: "Gemini models with a generous free tier.",
    keysUrl: "https://aistudio.google.com/app/apikey",
  },
  {
    id: "openai",
    label: "OpenAI",
    hint: "GPT models. Paid account required.",
    keysUrl: "https://platform.openai.com/api-keys",
  },
] as const;

function SetupPage() {
  const navigate = useNavigate();
  const [status, setStatus] = useState<SetupStatus | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [mongoUri, setMongoUri] = useState("");
  const [provider, setProvider] = useState<string>("openrouter");
  const [apiKey, setApiKey] = useState("");
  const [model, setModel] = useState("");

  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<"ok" | "fail" | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setupApi
      .status()
      .then((next) => {
        if (active) setStatus(next);
      })
      .catch((caught) => {
        if (active)
          setLoadError(
            caught instanceof ApiError
              ? caught.message
              : "Could not read the setup status."
          );
      });
    return () => {
      active = false;
    };
  }, []);

  const activeProvider =
    PROVIDERS.find((entry) => entry.id === provider) ?? PROVIDERS[0];

  const onTest = async () => {
    setTestResult(null);
    setError(null);
    setTesting(true);
    try {
      await setupApi.testMongo(mongoUri.trim());
      setTestResult("ok");
    } catch (caught) {
      setTestResult("fail");
      setError(
        caught instanceof ApiError ? caught.message : "Connection failed."
      );
    } finally {
      setTesting(false);
    }
  };

  const onSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setError(null);
    setBusy(true);
    try {
      await setupApi.complete({
        mongoUri: mongoUri.trim(),
        llmProvider: provider,
        llmApiKey: apiKey.trim(),
        llmModel: model.trim(),
      });
      void navigate({ to: "/signup", replace: true });
    } catch (caught) {
      setError(
        caught instanceof ApiError
          ? caught.message
          : "Setup failed. Check the values and try again."
      );
    } finally {
      setBusy(false);
    }
  };

  if (loadError) {
    return (
      <AuthCard
        title="Backend not reachable."
        subtitle="ProfileGPT starts its local server automatically. If you launched the app manually, make sure the backend is running, then reload."
      >
        <div className="flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
          <AlertCircle className="size-4 shrink-0 mt-0.5" />
          <span>{loadError}</span>
        </div>
      </AuthCard>
    );
  }

  if (status && !status.needsSetup) {
    return (
      <AuthCard
        title="You're all set."
        subtitle={`ProfileGPT ${status.version} is already configured${
          status.database.host ? ` and connected to ${status.database.host}` : ""
        }.`}
        footer={
          <>
            Return to{" "}
            <Link to="/login" className="text-accent hover:underline">
              sign in
            </Link>
          </>
        }
      >
        <Link to="/dashboard" className={primaryButtonClass}>
          <ArrowRight className="size-4" />
          Open ProfileGPT
        </Link>
      </AuthCard>
    );
  }

  return (
    <AuthCard
      title="Set up ProfileGPT."
      subtitle="Two values and you're in. Both are stored only on this machine, in this folder."
    >
      <form onSubmit={onSubmit}>
        {/* Step 1 — database */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Database className="size-3.5" />
            Step 1 · Database
          </div>

          <Field
            label="MongoDB connection string"
            hint="No local database needed — a free MongoDB Atlas cluster works. Create one, then copy its connection string here."
          >
            <input
              type="text"
              required
              spellCheck={false}
              autoComplete="off"
              value={mongoUri}
              onChange={(event) => {
                setMongoUri(event.target.value);
                setTestResult(null);
              }}
              className={`${inputClass} font-mono text-xs`}
              placeholder="mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/profilegpt"
            />
          </Field>

          <div className="flex flex-wrap items-center gap-3">
            <a
              href="https://www.mongodb.com/cloud/atlas/register"
              target="_blank"
              rel="noreferrer"
              className="text-xs text-accent hover:underline"
            >
              Create a free cluster →
            </a>
            <button
              type="button"
              onClick={() => void onTest()}
              disabled={testing || mongoUri.trim().length === 0}
              className={`${secondaryButtonClass} w-auto px-3 py-1.5 text-xs`}
            >
              {testing ? (
                <Loader2 className="size-3.5 animate-spin" />
              ) : testResult === "ok" ? (
                <CheckCircle2 className="size-3.5 text-emerald-400" />
              ) : null}
              Test connection
            </button>
            {testResult === "ok" && (
              <span className="text-xs text-emerald-400">Connected</span>
            )}
          </div>
        </div>

        {/* Step 2 — AI provider */}
        <div className="mb-6">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
            <Sparkles className="size-3.5" />
            Step 2 · AI provider
          </div>

          <Field label="Provider">
            <select
              value={provider}
              onChange={(event) => setProvider(event.target.value)}
              className={inputClass}
            >
              {PROVIDERS.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </Field>

          <Field
            label="API key"
            hint={`${activeProvider.hint} Get a key at ${activeProvider.keysUrl.replace(
              "https://",
              ""
            )}`}
          >
            <input
              type="password"
              required
              autoComplete="off"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              className={`${inputClass} font-mono text-xs`}
              placeholder="sk-…"
            />
          </Field>

          <Field label="Model (optional)" hint="Leave blank to use the default for the provider.">
            <input
              type="text"
              value={model}
              onChange={(event) => setModel(event.target.value)}
              className={`${inputClass} font-mono text-xs`}
              placeholder="e.g. google/gemini-2.5-flash"
            />
          </Field>
        </div>

        {error && (
          <div className="mb-4 flex items-start gap-2 rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-300">
            <AlertCircle className="size-4 shrink-0 mt-0.5" />
            <span>{error}</span>
          </div>
        )}

        <button type="submit" disabled={busy} className={primaryButtonClass}>
          {busy ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            <ArrowRight className="size-4" />
          )}
          {busy ? "Connecting…" : "Finish setup"}
        </button>
      </form>
    </AuthCard>
  );
}
