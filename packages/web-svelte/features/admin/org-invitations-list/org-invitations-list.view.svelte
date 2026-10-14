<script lang="ts">
  import EmptyState from "@org/components-svelte/patterns/empty-state.svelte";
  import ListRow from "@org/components-svelte/patterns/list-row.svelte";
  import Badge from "@org/components-svelte/primitives/badge.svelte";
  import Button from "@org/components-svelte/primitives/button.svelte";
  import { List } from "@org/components-svelte/primitives/list";
  import Stack from "@org/components-svelte/primitives/stack.svelte";
  import Text from "@org/components-svelte/primitives/text.svelte";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import {
    isResendingAtom,
    isRevokingAtom,
    orgInvitationsListAtom,
    orgInvitationsResultAtom,
    resendInvitationActionAtom,
    revokeInvitationActionAtom,
  } from "./org-invitations-list.view-model";

  const { orgId }: { readonly orgId: OrganizationId } = $props();

  const list = atomValue(() => orgInvitationsListAtom(orgId));
  const isResending = atomValue(isResendingAtom);
  const isRevoking = atomValue(isRevokingAtom);
  const resend = atomSet(resendInvitationActionAtom);
  const revoke = atomSet(revokeInvitationActionAtom);
</script>

<AtomResult atom={orgInvitationsResultAtom(orgId)}>
  {#snippet children()}
    {#if list.current.isEmpty}
      <EmptyState message="No pending invitations." />
    {:else}
      <List gap="sm" data-testid="org-invitations">
        {#each list.current.rows as row (row.invitationId)}
          <List.Item>
            <ListRow data-testid="org-invitations-row">
              <Stack direction="row" gap="sm" align="center">
                <Text weight="medium" truncate>{row.email}</Text>
                <Badge
                  variant={row.isExpired ? "destructive" : "secondary"}
                  data-testid="org-invitations-status"
                >
                  {row.isExpired ? "Expired" : "Pending"}
                </Badge>
              </Stack>
              <Text size="xs" tone="muted">Expires {row.expiresAtLabel}</Text>
              {#snippet trailing()}
                <Stack direction="row" gap="sm" align="center">
                  <Button
                    size="sm"
                    variant="outline"
                    disabled={isResending.current}
                    onClick={() => {
                      resend({ orgId, invitationId: row.invitationId });
                    }}
                    data-testid="org-invitations-resend"
                  >
                    Resend
                  </Button>
                  <Button
                    size="sm"
                    variant="destructive"
                    disabled={isRevoking.current}
                    onClick={() => {
                      revoke({ orgId, invitationId: row.invitationId });
                    }}
                    data-testid="org-invitations-revoke"
                  >
                    Revoke
                  </Button>
                </Stack>
              {/snippet}
            </ListRow>
          </List.Item>
        {/each}
      </List>
    {/if}
  {/snippet}
</AtomResult>
