// Stands in for SvelteKit's `$app/navigation` outside a Kit render. It records
// each `goto` so a test can read back the navigations a bridge made.
export const navigations: Array<string> = [];

export const goto = async (href: string): Promise<void> => {
  navigations.push(href);
};
