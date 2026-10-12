<script lang="ts">
  import CardSection from "@org/components/patterns/card-section.svelte";
  import PageShell from "@org/components/patterns/page-shell.svelte";
  import Link from "@org/components/primitives/link.svelte";
  import Skeleton from "@org/components/primitives/skeleton.svelte";
  import Stack from "@org/components/primitives/stack.svelte";

  import OrgInvitationsList from "@/features/admin/org-invitations-list/org-invitations-list.view.svelte";
  import OrgMembersList from "@/features/admin/org-members-list/org-members-list.view.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";

  import type { load } from "./+page.server";

  const { data }: { readonly data: Awaited<ReturnType<typeof load>> } = $props();
</script>

{#snippet rows()}
  <Stack direction="column" gap="sm">
    {#each [0, 1, 2] as index (index)}
      <Skeleton height="row" />
    {/each}
  </Stack>
{/snippet}

<PageShell>
  <CardSection title="Organization members">
    {#snippet action()}
      <Link
        href={`/admin/orgs/${data.orgId}/invite`}
        appearance="button"
        tone="default"
        underline="none"
        data-testid="admin-org-invite-link"
      >
        + Invite user
      </Link>
    {/snippet}
    <HydrationBoundary state={data.members} pending={rows}>
      <OrgMembersList orgId={data.orgId} />
    </HydrationBoundary>
  </CardSection>
  <CardSection title="Pending invitations" titleSize="lg">
    <HydrationBoundary state={data.invitations} pending={rows}>
      <OrgInvitationsList orgId={data.orgId} />
    </HydrationBoundary>
  </CardSection>
</PageShell>
