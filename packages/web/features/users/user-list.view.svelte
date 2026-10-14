<script lang="ts">
  import EmptyState from "@org/components/patterns/empty-state.svelte";
  import Pagination from "@org/components/patterns/pagination.svelte";
  import { List } from "@org/components/primitives/list";
  import Stack from "@org/components/primitives/stack.svelte";
  import Surface from "@org/components/primitives/surface.svelte";
  import Text from "@org/components/primitives/text.svelte";
  import type { UserContract } from "@org/contracts/api/Contracts";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import { changePageAtom, paginationAtom, usersResultAtom } from "./user-list.view-model";

  const pagination = atomValue(paginationAtom);
  const changePage = atomSet(changePageAtom);

  const describeAddress = (user: UserContract.User): string =>
    user.address !== null
      ? `${user.address.street}, ${user.address.postalCode} ${user.address.country}`
      : "No address on file";
</script>

<AtomResult atom={usersResultAtom}>
  {#snippet children({ users })}
    <Stack direction="column" gap="lg">
      {#if pagination.current.isEmpty}
        <EmptyState message="No users yet." />
      {:else}
        <List gap="sm" data-testid="user-list">
          {#each users as user (user.id)}
            <List.Item>
              <Surface
                tone="card"
                radius="md"
                border="all"
                padding="md"
                interactive="raise"
                data-testid="user-list-item"
              >
                <Stack
                  direction="column"
                  directionAbove="row"
                  gap="xs"
                  justify="between"
                  align="start"
                >
                  <Stack direction="column" grow shrinkBelowContent>
                    <Text weight="medium" truncate>{user.email}</Text>
                    <Text size="xs" tone="muted" truncate>{describeAddress(user)}</Text>
                  </Stack>
                  <Text size="xs" tone="muted">
                    Joined {user.createdAt.toString().slice(0, 10)}
                  </Text>
                </Stack>
              </Surface>
            </List.Item>
          {/each}
        </List>
      {/if}

      <Pagination
        page={pagination.current.page}
        totalPages={pagination.current.totalPages}
        total={pagination.current.total}
        hasPrevious={pagination.current.hasPrevious}
        hasNext={pagination.current.hasNext}
        onPrevious={() => {
          changePage("previous");
        }}
        onNext={() => {
          changePage("next");
        }}
        itemLabel="total"
      />
    </Stack>
  {/snippet}
</AtomResult>
