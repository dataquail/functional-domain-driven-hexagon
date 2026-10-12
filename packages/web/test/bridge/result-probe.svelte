<script lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import type * as Hydration from "effect/reactivity/Hydration";
  import { untrack } from "svelte";

  import AtomResult from "@/services/bridge/atom-result.svelte";
  import HydrationBoundary from "@/services/bridge/hydration-boundary.svelte";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const {
    atom,
    registry,
    state = [],
  }: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<string, string>>;
    readonly state?: ReadonlyArray<Hydration.DehydratedAtom>;
  } = $props();

  provideRegistry({ registry: untrack(() => registry) });
</script>

<svelte:boundary>
  <HydrationBoundary {state}>
    <AtomResult {atom}>
      {#snippet children(value)}
        <output data-testid="value">{value}</output>
      {/snippet}
    </AtomResult>
    {#snippet pending()}
      <output data-testid="pending">pending</output>
    {/snippet}
  </HydrationBoundary>
  {#snippet failed(error)}
    <output data-testid="failed">{String(error)}</output>
  {/snippet}
</svelte:boundary>
