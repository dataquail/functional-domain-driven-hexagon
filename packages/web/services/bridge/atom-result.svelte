<script module lang="ts">
  import type * as AsyncResult from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type { Snippet } from "svelte";

  export type AtomResultProps<A, E> = {
    readonly atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>;
    readonly children: Snippet<[A]>;
    readonly pending?: Snippet;
  };
</script>

<script lang="ts" generics="A, E">
  import * as Cause from "effect/Cause";

  import { atomValue } from "./atom-bridge.svelte";
  import { getPending } from "./pending-context";

  const { atom, children, pending }: AtomResultProps<A, E> = $props();

  const result = atomValue(() => atom);
  const routePending = getPending();
  const fallback = $derived(pending ?? routePending);

  // A failure goes to the nearest error boundary, as a suspense read does in React.
  const value = $derived.by(() => {
    const current = result.current;
    if (current._tag === "Failure") throw Cause.squash(current.cause);
    return current;
  });
</script>

{#if value._tag === "Success"}
  {@render children(value.value)}
{:else if fallback !== undefined}
  {@render fallback()}
{/if}
