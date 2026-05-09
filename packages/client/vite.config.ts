/// <reference types="vitest/config" />
/* eslint-disable */
import tailwindcss from "@tailwindcss/vite";
import { TanStackRouterVite } from "@tanstack/router-plugin/vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";
import { ViteUserConfig } from "vitest/config.js";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    TanStackRouterVite({ autoCodeSplitting: true }),
    react(),
    tailwindcss(),
    tsconfigPaths(),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: "stats.html",
      template: "treemap",
    }),
  ],
  server: {
    allowedHosts: true,
    // Same-origin proxy for the API server. Required so the browser sees
    // every fetch as same-origin with the SPA — the session cookie is
    // SameSite=Strict, which forbids cross-site cookie attachment, even
    // with CORS+credentials. Forwarding through Vite makes the cookie
    // scope to localhost:5173 (the browser's view) regardless of the
    // server's actual port.
    //
    // The `bypass` lets the SPA own paths that *also* exist on the API
    // (e.g. `/users` is both a TanStack Router route and an API endpoint).
    // A real browser navigation sends `Accept: text/html, …` — bypass
    // returns "/index.html" so Vite serves the SPA and the Router takes
    // over. SPA fetches send `Accept: application/json`/missing, so they
    // fall through to the proxy.
    proxy: {
      "/auth": "http://localhost:3001",
      "/users": {
        target: "http://localhost:3001",
        bypass: (req) =>
          req.headers.accept?.includes("text/html") === true ? "/index.html" : null,
      },
      "/todos": {
        target: "http://localhost:3001",
        bypass: (req) =>
          req.headers.accept?.includes("text/html") === true ? "/index.html" : null,
      },
    },
  },
  // Pre-bundle the worker's heavy deps so Vite doesn't discover them only
  // after the page mounts the worker and trigger a full-page reload mid-run.
  // The reload races with Playwright in CI; see add-todo flake.
  optimizeDeps: {
    include: [
      "@effect/platform-browser/BrowserRuntime",
      "@effect/platform-browser/BrowserWorkerRunner",
      "@effect/rpc/RpcServer",
    ],
  },
  build: {
    target: "esnext",
    minify: "terser",
    rollupOptions: {
      external: ["crypto"],
    },
  },
  envDir: "../../",
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    globals: true,
  } satisfies ViteUserConfig["test"],
  worker: {
    format: "es",
  },
});
