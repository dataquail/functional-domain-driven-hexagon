// Stands in for SvelteKit's `$app/navigation` outside a Kit render; a test mocks it.
export const goto = (_href: string): Promise<void> => Promise.resolve();
