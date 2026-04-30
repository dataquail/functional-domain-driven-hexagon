# Drivers

Layered abstraction between specs and Playwright/HTTP, per Synapse's `acceptance-testing` doc.

## `pages/`

Page Objects. Each file owns a route (`/users` → `UsersPage`, `/` → `IndexPage`) and exposes domain-shaped methods (`createUser`, `addTodo`). All `data-testid` selectors and Playwright `Locator` access lives here. Specs never see selectors.

## `workflows/` (extension point)

Composes Page Objects and (eventually) an API driver into multi-step business operations. Add a workflow when more than one spec needs the same arrange-act sequence. As of the initial scaffold, both specs are single-page and don't need a workflow tier; the folder exists for the obvious next step.

## API driver (extension point)

When a spec needs to arrange state without clicking through the UI (e.g. "seed three users, then assert the list paginates correctly"), add `api-driver.ts` here that calls `HttpApiClient.make(DomainApi, { baseUrl: API_URL })` against the running test server. Use the typed contract — same client the React app consumes. Synapse's "use APIs for arrangement" rule says to skip API arrangement only when the spec is genuinely about the UI flow being arranged.
