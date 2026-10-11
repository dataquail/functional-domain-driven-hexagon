<script lang="ts">
  import "@org/components-svelte/styles/globals.css";

  import ThemeProvider from "@org/components-svelte/providers/theme-provider.svelte";
  import type { Snippet } from "svelte";

  const { children }: { readonly children: Snippet } = $props();
</script>

<ThemeProvider>
  {@render children()}
</ThemeProvider>
