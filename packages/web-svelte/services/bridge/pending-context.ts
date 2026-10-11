import { createContext, type Snippet } from "svelte";

const [getPendingContext, setPendingContext, hasPendingContext] = createContext<
  Snippet | undefined
>();

// The fallback a route shows wherever a result it hydrates is still initial: the
// one thing React's Suspense boundary gave a route and a View does not choose.
export const providePending = (pending: Snippet | undefined): void => {
  setPendingContext(pending);
};

export const getPending = (): Snippet | undefined =>
  hasPendingContext() ? getPendingContext() : undefined;
