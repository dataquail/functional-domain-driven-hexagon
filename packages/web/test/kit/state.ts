// Stands in for SvelteKit's `$app/state` outside a Kit render; a test points
// `page.url` at the path it renders under.
export const page = { url: new URL("http://localhost/"), params: {} };
