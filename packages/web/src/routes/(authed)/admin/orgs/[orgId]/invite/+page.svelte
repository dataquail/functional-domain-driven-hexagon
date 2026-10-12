<script lang="ts">
  import CardSection from "@org/components/patterns/card-section.svelte";
  import PageShell from "@org/components/patterns/page-shell.svelte";
  import Link from "@org/components/primitives/link.svelte";
  import { OrganizationId } from "@org/contracts/EntityIds";

  import InviteForm from "@/features/invite/invite-form/invite-form.view.svelte";
  import { page } from "$app/state";

  const orgId = $derived(OrganizationId.make(page.params.orgId ?? ""));
</script>

<PageShell width="sm">
  <CardSection title="Invite a user">
    {#snippet action()}
      <Link href={`/admin/orgs/${orgId}`} tone="muted" underline="none">← Back to org</Link>
    {/snippet}
    <InviteForm {orgId} />
  </CardSection>
</PageShell>
