import * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { createContext, onDestroy } from "svelte";

const [getRegistryContext, setRegistryContext] = createContext<AtomRegistry.AtomRegistry>();

export type ProvideRegistryOptions = {
  readonly registry?: AtomRegistry.AtomRegistry;
  readonly initialValues?: NonNullable<Parameters<typeof AtomRegistry.make>[0]>["initialValues"];
  readonly defaultIdleTTL?: number;
};

// A registry this provider created dies with the component that provided it, so
// an SSR render never leaves one behind. A registry handed in belongs to its caller.
export const provideRegistry = (
  options: ProvideRegistryOptions = {},
): AtomRegistry.AtomRegistry => {
  const registry =
    options.registry ??
    AtomRegistry.make({
      initialValues: options.initialValues,
      defaultIdleTTL: options.defaultIdleTTL,
    });
  if (options.registry === undefined)
    onDestroy(() => {
      registry.dispose();
    });
  return setRegistryContext(registry);
};

export const getRegistry = (): AtomRegistry.AtomRegistry => getRegistryContext();
