<script lang="ts">
  import "@org/components/styles/globals.css";

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
