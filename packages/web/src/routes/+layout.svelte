<script lang="ts">
  // Compiled by `pnpm css` from the component library's globals.css before Vite
  // starts: Tailwind's loader cannot run under the module hooks of Alchemy's dev server.
  import "../styles.generated.css";

  import ThemeProvider from "@org/components/providers/theme-provider.svelte";
  import type { Snippet } from "svelte";

  import AtomProvider from "@/services/atom/atom-provider.svelte";

  const { children }: { readonly children: Snippet } = $props();
</script>

<ThemeProvider>
  <AtomProvider>
    {@render children()}
  </AtomProvider>
</ThemeProvider>
