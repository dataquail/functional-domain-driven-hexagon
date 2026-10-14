import * as Option from "effect/Option";
import { createContext, type Snippet } from "svelte";

const [getPendingContext, setPendingContext, hasPendingContext] =
  createContext<Option.Option<Snippet>>();

// The fallback a route shows wherever a result it hydrates is still initial: the
// one thing React's Suspense boundary gave a route and a View does not choose.
export const providePending = (pending: Option.Option<Snippet>): void => {
  setPendingContext(pending);
};

export const getPending = (): Option.Option<Snippet> => {
  if (hasPendingContext()) return getPendingContext();

  return Option.none();
};
