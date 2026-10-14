<script module lang="ts">
  // Named, because a `>` inside the generics attribute would end the script tag
  // for the architecture CLI's Svelte reader.
  export type ViewProps = Record<string, unknown>;
</script>

<script lang="ts" generics="Props extends ViewProps">
  import { Toaster } from "@org/components-svelte/primitives/toaster";
  import ThemeProvider from "@org/components-svelte/providers/theme-provider.svelte";
  import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
  import { type Component, untrack } from "svelte";

  import NotificationBridge from "@/services/atom/notification-bridge.svelte";
  import { provideRegistry } from "@/services/bridge/registry-context";

  const {
    props,
    registry,
    view,
  }: {
    readonly registry: AtomRegistry.AtomRegistry;
    readonly view: Component<Props>;
    readonly props: Props;
  } = $props();

  provideRegistry({ registry: untrack(() => registry) });
  const View = untrack(() => view);
</script>

<ThemeProvider>
  <View {...props} />
  <NotificationBridge />
  <Toaster />
</ThemeProvider>
