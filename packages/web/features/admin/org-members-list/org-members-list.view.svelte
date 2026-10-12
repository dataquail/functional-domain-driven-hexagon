<script lang="ts">
  // Shared member roster. `canManage` hides the management controls for a plain
  // member; the backend still refuses any mutation they are not allowed.
  import EmptyState from "@org/components/patterns/empty-state.svelte";
  import ListRow from "@org/components/patterns/list-row.svelte";
  import Badge from "@org/components/primitives/badge.svelte";
  import Button from "@org/components/primitives/button.svelte";
  import { List } from "@org/components/primitives/list";
  import Stack from "@org/components/primitives/stack.svelte";
  import Text from "@org/components/primitives/text.svelte";
  import type { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import {
    demoteMemberActionAtom,
    isChangingRoleAtom,
    isRemovingAtom,
    orgMembersListAtom,
    orgMembersResultAtom,
    promoteMemberActionAtom,
    removeMemberActionAtom,
  } from "./org-members-list.view-model";

  const {
    canManage = true,
    orgId,
  }: { readonly orgId: OrganizationId; readonly canManage?: boolean } = $props();

  const list = atomValue(() => orgMembersListAtom(orgId));
  const isChangingRole = atomValue(isChangingRoleAtom);
  const isRemoving = atomValue(isRemovingAtom);
  const remove = atomSet(removeMemberActionAtom);
  const promote = atomSet(promoteMemberActionAtom);
  const demote = atomSet(demoteMemberActionAtom);
</script>

<AtomResult atom={orgMembersResultAtom(orgId)}>
  {#snippet children()}
    {#if list.current.isEmpty}
      <EmptyState message="No members in this organization yet." />
    {:else}
      <List gap="sm" data-testid="admin-org-members">
        {#each list.current.rows as row (row.userId)}
          {#snippet controls()}
            <Stack direction="row" gap="sm" align="center">
              {#if row.isAdmin}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isChangingRole.current}
                  onClick={() => {
                    demote({ orgId, userId: row.userId });
                  }}
                  data-testid="admin-org-members-demote"
                >
                  Demote
                </Button>
              {:else}
                <Button
                  size="sm"
                  variant="outline"
                  disabled={isChangingRole.current}
                  onClick={() => {
                    promote({ orgId, userId: row.userId });
                  }}
                  data-testid="admin-org-members-promote"
                >
                  Promote
                </Button>
              {/if}
              <Button
                size="sm"
                variant="destructive"
                disabled={isRemoving.current}
                onClick={() => {
                  remove({ orgId, userId: row.userId });
                }}
                data-testid="admin-org-members-remove"
              >
                Remove
              </Button>
            </Stack>
          {/snippet}
          <List.Item>
            <ListRow
              data-testid="admin-org-members-row"
              trailing={canManage ? controls : undefined}
            >
              <Stack direction="row" gap="sm" align="center">
                <Text weight="medium" truncate>{row.email}</Text>
                {#if row.isAdmin}
                  <Badge variant="default" data-testid="admin-org-members-admin-badge">Admin</Badge>
                {/if}
              </Stack>
              <Text size="xs" tone="muted">Joined {row.joinedAtLabel}</Text>
            </ListRow>
          </List.Item>
        {/each}
      </List>
    {/if}
  {/snippet}
</AtomResult>
