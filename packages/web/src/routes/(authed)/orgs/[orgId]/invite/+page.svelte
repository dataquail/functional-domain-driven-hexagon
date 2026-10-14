<script lang="ts">
  import CardSection from "@org/components/patterns/card-section.svelte";
  import PageShell from "@org/components/patterns/page-shell.svelte";

  import InviteForm from "@/features/invite/invite-form/invite-form.view.svelte";

  import type { load as orgLoad } from "../+layout.server";

  const { data }: { readonly data: Awaited<ReturnType<typeof orgLoad>> } = $props();
</script>

<PageShell width="sm">
  <CardSection title="Invite a teammate">
    <InviteForm orgId={data.orgId} />
  </CardSection>
</PageShell>
