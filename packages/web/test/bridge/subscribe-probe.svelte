<script lang="ts">
  import type * as Atom from "effect/reactivity/Atom";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { untrack } from "svelte";

  import { atomSubscribe } from "@/services/bridge/atom-bridge.svelte";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const {
    atom,
    listener,
    registry,
  }: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly atom: Atom.Atom<number>;
    readonly listener: (value: number) => void;
  } = $props();

  provideRegistry({ registry: untrack(() => registry) });

  atomSubscribe(
    untrack(() => atom),
    (value) => listener(value),
  );
</script>
