<script lang="ts">
  import EmptyState from "@org/components/patterns/empty-state.svelte";
  import ListRow from "@org/components/patterns/list-row.svelte";
  import Pagination from "@org/components/patterns/pagination.svelte";
  import Badge from "@org/components/primitives/badge.svelte";
  import Button from "@org/components/primitives/button.svelte";
  import Link from "@org/components/primitives/link.svelte";
  import { List } from "@org/components/primitives/list";
  import Stack from "@org/components/primitives/stack.svelte";
  import Text from "@org/components/primitives/text.svelte";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import {
    adminOrgsResultAtom,
    changePageAtom,
    orgsListAtom,
    restoreOrgActionAtom,
    softDeleteOrgActionAtom,
    toggleIncludeDeletedAtom,
  } from "./orgs-list.view-model";

  const view = atomValue(orgsListAtom);
  const changePage = atomSet(changePageAtom);
  const toggleIncludeDeleted = atomSet(toggleIncludeDeletedAtom);
  const softDelete = atomSet(softDeleteOrgActionAtom);
  const restore = atomSet(restoreOrgActionAtom);
</script>

<AtomResult atom={adminOrgsResultAtom}>
  {#snippet children()}
    <Stack direction="column" gap="lg">
      <Stack direction="row" align="center" justify="between">
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            toggleIncludeDeleted();
          }}
          data-testid="orgs-toggle-deleted"
        >
          {view.current.includeDeleted ? "Hide deleted" : "Show deleted"}
        </Button>
        <Text tone="muted">{view.current.total} total</Text>
      </Stack>

      {#if view.current.isEmpty}
        <EmptyState message="No organizations." />
      {:else}
        <List gap="sm" data-testid="admin-orgs-list">
          {#each view.current.rows as row (row.id)}
            <List.Item>
              <ListRow data-testid="admin-orgs-row">
                {#if row.href}
                  <Link
                    href={row.href}
                    tone="default"
                    underline="hover"
                    data-testid="admin-orgs-row-link"
                  >
                    <Text weight="medium" truncate>{row.name}</Text>
                  </Link>
                {:else}
                  <Text weight="medium" truncate>{row.name}</Text>
                {/if}
                <Text size="xs" tone="muted">Created {row.createdAtLabel}</Text>
                {#if row.deletedAtLabel}
                  <Text size="xs" tone="destructive">Deleted {row.deletedAtLabel}</Text>
                {/if}
                {#snippet trailing()}
                  <Stack direction="row" gap="sm" align="center">
                    <Badge variant={row.isDeleted ? "outline" : "default"}>
                      {row.isDeleted ? "Deleted" : "Active"}
                    </Badge>
                    {#if row.isDeleted}
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          restore(row.id);
                        }}
                        data-testid="admin-orgs-restore"
                      >
                        Restore
                      </Button>
                    {:else}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => {
                          softDelete(row.id);
                        }}
                        data-testid="admin-orgs-delete"
                      >
                        Delete
                      </Button>
                    {/if}
                  </Stack>
                {/snippet}
              </ListRow>
            </List.Item>
          {/each}
        </List>
      {/if}

      <Pagination
        page={view.current.page}
        totalPages={view.current.totalPages}
        total={view.current.total}
        hasPrevious={view.current.hasPrevious}
        hasNext={view.current.hasNext}
        onPrevious={() => {
          changePage("previous");
        }}
        onNext={() => {
          changePage("next");
        }}
        itemLabel="organizations"
      />
    </Stack>
  {/snippet}
</AtomResult>
