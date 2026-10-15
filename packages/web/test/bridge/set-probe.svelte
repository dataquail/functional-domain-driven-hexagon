<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";

  import { atomSet } from "@/services/bridge/atom-bridge.svelte";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const {
    atom,
    next,
    registry,
  }: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Writable<number>;
    readonly next: number;
  } = $props();

  provideRegistry({ registry: untrack(() => registry) });

  const set = atomSet(() => atom);
</script>

<button type="button" onclick={() => set(next)}>set</button>
