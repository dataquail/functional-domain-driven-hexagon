// Stands in for SvelteKit's `$app/server` outside a Kit render; a test mocks it.
export const getRequestEvent = (): never => {
  throw new Error("getRequestEvent() has no request outside a SvelteKit render");
};
