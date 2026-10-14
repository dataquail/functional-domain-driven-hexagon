<script lang="ts">
  import EmptyState from "@org/components/patterns/empty-state.svelte";
  import { Card } from "@org/components/primitives/card";
  import { Grid } from "@org/components/primitives/grid";
  import Heading from "@org/components/primitives/heading.svelte";
  import Link from "@org/components/primitives/link.svelte";

  import { atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import { myOrgsResultAtom, orgPickerAtom } from "./org-picker.view-model";

  const orgPicker = atomValue(orgPickerAtom);
</script>

<AtomResult atom={myOrgsResultAtom}>
  {#snippet children()}
    {#if orgPicker.current.isEmpty}
      <EmptyState
        message="You don't belong to any organizations yet. Create one below to get started."
      />
    {:else}
      <Grid columnsAbove={2} gap="md" data-testid="org-picker">
        {#each orgPicker.current.cards as card (card.id)}
          <Grid.Item>
            <Link
              href={card.href}
              block
              tone="inherit"
              underline="none"
              data-testid="org-picker-item"
            >
              <Card interactive="raise">
                <Card.Header>
                  <Heading level={3} size="md">{card.name}</Heading>
                </Card.Header>
              </Card>
            </Link>
          </Grid.Item>
        {/each}
      </Grid>
    {/if}
  {/snippet}
</AtomResult>
