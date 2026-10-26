// Build target for the portable desktop app.
//
// The default config emits a Cloudflare Worker bundle (SSR HTML generated at
// request time). A downloadable ZIP can't assume a Worker runtime on the user's
// machine, so this config builds a static SPA instead: `index.html` plus assets
// that Express serves directly.
//
// Usage: npm run build:desktop   → frontend/dist/client
import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // No Worker output; the Node backend hosts the files.
  cloudflare: false,

  // The dev-only overlay plugins are pointless in this build.
  ssrErrorLogger: false,
  serverFnErrorLogger: false,

  tanstackStart: {
    spa: {
      enabled: true,
    },
  },
});
