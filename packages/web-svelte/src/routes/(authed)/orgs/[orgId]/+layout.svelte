<script lang="ts">
  import Stack from "@org/components-svelte/primitives/stack.svelte";
  import type { Snippet } from "svelte";

  import OrgNav from "@/features/__root/org-nav.view.svelte";

  import type { load } from "./+layout.server";

  const {
    children,
    data,
  }: { readonly children: Snippet; readonly data: Awaited<ReturnType<typeof load>> } = $props();
</script>

<OrgNav orgId={data.orgId} isAdmin={data.isAdmin} />
<Stack direction="column" grow paddingY="md">
  {@render children()}
</Stack>
