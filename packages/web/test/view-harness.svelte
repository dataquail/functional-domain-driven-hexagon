<script module lang="ts">
  // A generic constraint, named only because a `>` inside the generics attribute
  // would end the script tag for the architecture CLI's Svelte reader.
  // oxlint-disable-next-line effect/noUnsafeDictionaryType, anti-slop/no-unsafe-dictionary-type -- a generic constraint, which both rules allow when written in place
  export type ViewProps = Record<string, unknown>;
</script>

<script lang="ts" generics="Props extends ViewProps">
  import * as Option from "effect/Option";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { type Component, createRawSnippet, untrack } from "svelte";

  import { providePending } from "@/services/bridge/pending-context";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const {
    fallback = "loading",
    props,
    registry,
    view,
  }: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly view: Component<Props>;
    readonly props: Props;
    readonly fallback?: string;
  } = $props();

  provideRegistry({ registry: untrack(() => registry) });

  providePending(
    Option.some(
      createRawSnippet(() => ({ render: () => `<span>${untrack(() => fallback)}</span>` })),
    ),
  );

  const View = untrack(() => view);
</script>

<View {...props} />
