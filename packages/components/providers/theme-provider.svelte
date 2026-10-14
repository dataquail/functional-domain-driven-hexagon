<script module lang="ts">
  import type { Snippet } from "svelte";

  import type { Theme, ThemeStorage } from "./theme.svelte";

  export type ThemeProviderProps = {
    readonly children: Snippet;
    readonly defaultTheme?: Theme;
    readonly storageKey?: string;
    readonly storage?: () => ThemeStorage;
  };
</script>

<script lang="ts">
  import { untrack } from "svelte";

  import { browserThemeStorage, provideTheme, ThemeState } from "./theme.svelte";

  const {
    children,
    defaultTheme = "system",
    storage = browserThemeStorage,
    storageKey = "web-ui-theme",
  }: ThemeProviderProps = $props();

  const state = provideTheme(untrack(() => new ThemeState(defaultTheme, storageKey, storage)));

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
