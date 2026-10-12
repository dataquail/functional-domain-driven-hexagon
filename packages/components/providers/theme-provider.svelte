<script module lang="ts">
  import type { Snippet } from "svelte";

  import type { Theme } from "./theme.svelte";

  export type ThemeProviderProps = {
    readonly children: Snippet;
    readonly defaultTheme?: Theme;
    readonly storageKey?: string;
  };
</script>

<script lang="ts">
  import { untrack } from "svelte";

  import { provideTheme, ThemeState } from "./theme.svelte";

  const {
    children,
    defaultTheme = "system",
    storageKey = "web-ui-theme",
  }: ThemeProviderProps = $props();

  const state = provideTheme(untrack(() => new ThemeState(defaultTheme, storageKey)));

  $effect(() => {
    state.restore();
  });

  $effect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");
    root.classList.add(state.actualTheme);
  });
</script>

{@render children()}
