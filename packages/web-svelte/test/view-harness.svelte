<script module lang="ts">
  // Named, because a `>` inside the generics attribute would end the script tag
  // for the architecture CLI's Svelte reader.
  export type ViewProps = Record<string, unknown>;
</script>

<script lang="ts" generics="Props extends ViewProps">
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
    createRawSnippet(() => ({ render: () => `<span>${untrack(() => fallback)}</span>` })),
  );
  const View = untrack(() => view);
</script>

<View {...props} />
