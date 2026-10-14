<script lang="ts">
  import { Toaster } from "@org/components-svelte/primitives/toaster";
  import type { Snippet } from "svelte";

  import { provideRegistry } from "@/services/bridge/registry-context";
  import { browser } from "$app/env";

  import NavigationBridge from "./navigation-bridge.svelte";
  import NotificationBridge from "./notification-bridge.svelte";

  const { children }: { readonly children: Snippet } = $props();

  // One registry per tab, and one per server render that dies with it. Long
  // enough that navigating away and back re-uses a fetched page, short enough
  // that a stale page is not served indefinitely.
  const IDLE_TTL_MS = 30_000;
  provideRegistry(browser ? { defaultIdleTTL: IDLE_TTL_MS } : {});
</script>

{@render children()}
<NavigationBridge />
<NotificationBridge />
<Toaster />
