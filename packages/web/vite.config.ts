import { sveltekit } from "@sveltejs/kit/vite";
import tailwindcss from "@tailwindcss/vite";
import { defineConfig } from "vite";

import { webSvelteAliases } from "./aliases";

// No adapter: the Alchemy stack's SvelteKit resource injects its own Cloudflare
// adapter at build time and runs this file's dev server under `alchemy dev`.
export default defineConfig({
  plugins: [tailwindcss(), sveltekit()],
  resolve: { alias: webSvelteAliases },
});
