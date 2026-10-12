<script lang="ts">
  import AppShell from "@org/components/patterns/app-shell.svelte";
  import type { Snippet } from "svelte";

  import Nav from "@/features/__root/nav.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";

  import type { load } from "./+layout.server";

  const {
    children,
    data,
  }: { readonly children: Snippet; readonly data: Awaited<ReturnType<typeof load>> } = $props();
</script>

<HydrationBoundary state={data.prefetched}>
  <AppShell>
    {#snippet nav()}
      <Nav isSuperAdmin={data.user.isSuperAdmin} />
    {/snippet}
    {@render children()}
  </AppShell>
</HydrationBoundary>
