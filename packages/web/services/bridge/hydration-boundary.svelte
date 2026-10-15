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
  import * as Option from "effect/Option";
  import { untrack } from "svelte";

  import { hydrateExisting, hydrateNew } from "./hydration";
  import { providePending } from "./pending-context";
  import { getRegistry } from "./registry-context";

  const { children, pending, state }: HydrationBoundaryProps = $props();

  const registry = getRegistry();

  providePending(Option.fromUndefinedOr(untrack(() => pending)));

  const initialState = untrack(() => state);
  const existing = hydrateNew(registry, initialState);

  if (typeof window === "undefined") hydrateExisting(registry, existing);

  $effect(() => {
    const next = state;

    if (next === initialState) {
      untrack(() => hydrateExisting(registry, existing));

      return;
    }

    untrack(() => hydrateExisting(registry, hydrateNew(registry, next)));
  });
</script>

{@render children()}
