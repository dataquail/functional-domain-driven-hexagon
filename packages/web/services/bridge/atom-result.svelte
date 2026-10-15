<script module lang="ts">
  import type * as AsyncResultTypes from "effect/reactivity/AsyncResult";
  import type * as Atom from "effect/reactivity/Atom";
  import type { Snippet } from "svelte";

  export type AtomResultProps<A, E> = {
    readonly atom: Atom.Atom<AsyncResultTypes.AsyncResult<A, E>>;
    readonly children: Snippet<[A]>;
    readonly pending?: Snippet;
  };
</script>

<script lang="ts" generics="A, E">
  import * as Cause from "effect/Cause";
  import * as Option from "effect/Option";
  import * as AsyncResult from "effect/reactivity/AsyncResult";

  import { atomValue } from "./atom-bridge.svelte";
  import { getPending } from "./pending-context";

  const { atom, children, pending }: AtomResultProps<A, E> = $props();

  const result = atomValue(() => atom);
  const routePending = getPending();
  const fallback = $derived(Option.orElse(Option.fromUndefinedOr(pending), () => routePending));

  // A failure goes to the nearest error boundary, as a suspense read does in React.
  const value = $derived.by(() => {
    const current = result.current;

    // oxlint-disable-next-line effect/noThrowStatement -- Svelte's error boundary catches only what a derived throws
    if (AsyncResult.isFailure(current)) throw Cause.squash(current.cause);

    return current;
  });
</script>

{#if AsyncResult.isSuccess(value)}
  {@render children(value.value)}
{:else if Option.isSome(fallback)}
  {@render fallback.value()}
{/if}
