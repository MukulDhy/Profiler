import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    google?: {
      accounts?: {
        id?: {
          initialize: (options: Record<string, unknown>) => void;
          renderButton: (
            element: HTMLElement,
            options: Record<string, unknown>
          ) => void;
          cancel: () => void;
        };
      };
    };
  }
}

const CLIENT_ID = (import.meta.env.VITE_GOOGLE_CLIENT_ID as string | undefined) ?? "";

export function GoogleButton({
  enabled,
  onCredential,
  label = "Continue with Google",
}: {
  enabled: boolean;
  onCredential: (credential: string) => void;
  label?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [scriptReady, setScriptReady] = useState(false);
  const [scriptFailed, setScriptFailed] = useState(false);

  useEffect(() => {
    if (!enabled || !CLIENT_ID) return;

    const existing = document.querySelector<HTMLScriptElement>(
      'script[src="https://accounts.google.com/gsi/client"]'
    );

    const handleLoad = () => setScriptReady(true);
    const handleError = () => setScriptFailed(true);

    if (existing) {
      if (window.google?.accounts?.id) {
        setScriptReady(true);
      } else {
        existing.addEventListener("load", handleLoad);
        existing.addEventListener("error", handleError);
      }
      return () => {
        existing.removeEventListener("load", handleLoad);
        existing.removeEventListener("error", handleError);
      };
    }

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.addEventListener("load", handleLoad);
    script.addEventListener("error", handleError);
    document.head.appendChild(script);

    return () => {
      script.removeEventListener("load", handleLoad);
      script.removeEventListener("error", handleError);
    };
  }, [enabled]);

  useEffect(() => {
    if (!scriptReady || !enabled || !CLIENT_ID) return;
    const container = containerRef.current;
    const googleId = window.google?.accounts?.id;
    if (!container || !googleId) return;

    googleId.initialize({
      client_id: CLIENT_ID,
      callback: (response: { credential?: string }) => {
        if (response.credential) onCredential(response.credential);
      },
      ux_mode: "popup",
    });

    container.innerHTML = "";
    googleId.renderButton(container, {
      theme: "filled_black",
      size: "large",
      shape: "pill",
      text: "continue_with",
      width: 360,
      logo_alignment: "left",
    });

    return () => {
      try {
        googleId.cancel();
      } catch {
        // ignore
      }
    };
  }, [scriptReady, enabled, onCredential]);

  if (!enabled || !CLIENT_ID) {
    return (
      <div className="rounded-lg border border-dashed border-border px-4 py-2.5 text-center text-[11px] text-muted-foreground">
        Google sign-in is not configured on this deployment.
      </div>
    );
  }

  if (scriptFailed) {
    return (
      <div className="rounded-lg border border-border px-4 py-2.5 text-center text-[11px] text-muted-foreground">
        Could not load Google sign-in. Use email and password instead.
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={containerRef} className="flex justify-center min-h-10" />
      <p className="text-center text-[10px] font-mono uppercase tracking-widest text-muted-foreground">
        {label}
      </p>
    </div>
  );
}
