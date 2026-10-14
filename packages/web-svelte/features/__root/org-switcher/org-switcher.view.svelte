<script lang="ts">
  import Button from "@org/components-svelte/primitives/button.svelte";
  import { PlusIcon } from "@org/components-svelte/primitives/icon";
  import Select from "@org/components-svelte/primitives/select.svelte";
  import Skeleton from "@org/components-svelte/primitives/skeleton.svelte";
  import Stack from "@org/components-svelte/primitives/stack.svelte";
  import Text from "@org/components-svelte/primitives/text.svelte";
  import { OrganizationId } from "@org/contracts/EntityIds";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";
  import AtomResult from "@/services/bridge/atom-result.svelte";

  import {
    createNewOrgAtom,
    orgSwitcherAtom,
    orgSwitcherResultAtom,
    selectOrgAtom,
  } from "./org-switcher.view-model";

  const switcher = atomValue(orgSwitcherAtom);
  const selectOrg = atomSet(selectOrgAtom);
  const createNew = atomSet(createNewOrgAtom);
</script>

<AtomResult atom={orgSwitcherResultAtom}>
  {#snippet children()}
    {#if !switcher.current.isEmpty}
      <Stack direction="row" gap="xs" align="center">
        <Select
          value={switcher.current.activeOrgId ?? undefined}
          onValueChange={(value) => {
            selectOrg(OrganizationId.make(value));
          }}
          items={switcher.current.options.map((option) => ({
            value: option.id,
            label: option.name,
            "data-testid": "org-switcher-option",
          }))}
          placeholder="Select an organization…"
          width="md"
          data-testid="org-switcher"
        />
        <Button
          type="button"
          size="icon"
          variant="ghost"
          onClick={() => {
            createNew();
          }}
          aria-label="Create a new organization"
          data-testid="org-switcher-create-new"
        >
          <PlusIcon />
          <Text as="span" srOnly>Create a new organization</Text>
        </Button>
      </Stack>
    {/if}
  {/snippet}
  {#snippet pending()}
    <Skeleton width="switcher" height="control" />
  {/snippet}
</AtomResult>
