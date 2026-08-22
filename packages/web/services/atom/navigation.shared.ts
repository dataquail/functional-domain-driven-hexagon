// Routing as state, in both directions.
//
// A View may only read the atom graph, so the router cannot be a hook it calls:
// the current path arrives as `pathnameAtom` and a request to move arrives as
// `navigationRequestAtom`. One bridge component at the edge of the app owns the
// actual Next router; everything upstream of it is plain values a test can set
// and read.

import * as Atom from "effect/unstable/reactivity/Atom";

// Kept alive: the bridge subscribes for the app's whole lifetime, and a
// navigation request that the registry released before the bridge read it would
// be a navigation that silently did not happen.
export const pathnameAtom = Atom.keepAlive(Atom.make("/"));

export type NavigationRequest = {
  // Two consecutive requests to the same href are two navigations; the
  // sequence is what makes the second one observable.
  readonly seq: number;
  readonly href: string;
};

export const navigationRequestAtom = Atom.keepAlive(Atom.make<NavigationRequest | null>(null));

// The narrow slice of atom context this module needs, named structurally so a
// `fn`/`fnSync` action can pass its own smaller context straight through.
export type NavigationSink = {
  <A>(atom: Atom.Atom<A>): A;
  set<R, W>(atom: Atom.Writable<R, W>, value: W): void;
};

export const navigateTo = (get: NavigationSink, href: string): void => {
  const previous = get(navigationRequestAtom);
  get.set(navigationRequestAtom, { seq: (previous?.seq ?? 0) + 1, href });
};
