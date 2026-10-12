<script module lang="ts">
  import type * as Hydration from "effect/reactivity/Hydration";
  import type { Snippet } from "svelte";

  export type HydrationBoundaryProps = {
    readonly state: ReadonlyArray<Hydration.DehydratedAtom>;
    readonly children: Snippet;
    readonly pending?: Snippet;
  };
</script>

<script lang="ts">
  import { untrack } from "svelte";

  import { hydrateExisting, hydrateNew } from "./hydration";
  import { providePending } from "./pending-context";
  import { getRegistry } from "./registry-context";

  const { children, pending, state }: HydrationBoundaryProps = $props();

  const registry = getRegistry();
  providePending(untrack(() => pending));

  const existing = hydrateNew(
    registry,
    untrack(() => state),
  );
  if (typeof window === "undefined") hydrateExisting(registry, existing);

  let mounted = false;
  $effect(() => {
    const next = state;
    if (!mounted) {
      mounted = true;
      untrack(() => hydrateExisting(registry, existing));
      return;
    }
    untrack(() => hydrateExisting(registry, hydrateNew(registry, next)));
  });
</script>

{@render children()}
