import * as Atom from "effect/reactivity/Atom";
import type * as AtomRegistry from "effect/reactivity/AtomRegistry";
import { untrack } from "svelte";
import { createSubscriber } from "svelte/reactivity";

import { getRegistry } from "./registry-context";

export type AtomInput<A extends Atom.Atom<unknown>> = A | (() => A);

export type AtomValue<A> = { readonly current: A };

const resolve = <A extends Atom.Atom<unknown>>(input: AtomInput<A>): A => {
  if (Atom.isAtom(input)) return input;

  return input();
};

// Building a node can notify other nodes' listeners while a template, a derived
// or a block condition is reading, and Svelte refuses a state write there.
const outsideReads =
  <A>(notify: (value: A) => void) =>
  (value: A): void => {
    if (!$effect.tracking()) {
      notify(value);

      return;
    }

    // oxlint-disable-next-line effect/noGlobals -- Svelte's own microtask queue; the write must land before Svelte flushes, which an Effect scheduler does not promise
    queueMicrotask(() => {
      notify(value);
    });
  };

const subscriberFor = <A>(registry: AtomRegistry.AtomRegistry, atom: Atom.Atom<A>) => {
  const subscribe = createSubscriber((update) =>
    registry.subscribe(
      atom,
      outsideReads(() => {
        update();
      }),
    ),
  );

  return (): A => {
    const value = registry.get(atom);
    subscribe();

    return value;
  };
};

export const atomValue = <A>(input: AtomInput<Atom.Atom<A>>): AtomValue<A> => {
  const registry = getRegistry();
  const read = $derived(subscriberFor(registry, resolve(input)));

  return {
    get current() {
      return read();
    },
  };
};

export const atomSet = <R, W>(input: AtomInput<Atom.Writable<R, W>>): ((value: W) => void) => {
  const registry = getRegistry();
  $effect(() => {
    const atom = resolve(input);

    return untrack(() => registry.mount(atom));
  });

  return (value) => {
    registry.set(resolve(input), value);
  };
};

export const atomSubscribe = <A>(atom: Atom.Atom<A>, listener: (value: A) => void): void => {
  const registry = getRegistry();
  $effect(() =>
    untrack(() => {
      registry.get(atom);

      return registry.subscribe(atom, outsideReads(listener));
    }),
  );
};
