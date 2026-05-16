# `@org/test-drivers` — tier-agnostic page drivers

Each driver speaks **business intent** (`createUser`,
`expectUserInList`) at **user-perceivable granularity** (visible text,
ARIA roles, presence/absence). The same set of methods is implemented
at every test tier.

## Setup-context tiers

The driver is tier-agnostic. The **setup** context is not — that's
the divergence point between integration and acceptance.

| Tier        | Setup context              | What "seed" / "control" means                                                           |
| ----------- | -------------------------- | --------------------------------------------------------------------------------------- |
| Presenter   | Layer-substituted services | Pre-seed the `FakeApiClient`; recording fakes for assertions.                           |
| Integration | MSW handlers + fixtures    | Register per-test handlers via `server.use(...handlers.users.list(...))`. See ADR-0019. |
| Acceptance  | Real backend, real DB      | Seed via real HTTP endpoints (API arrangement), Stripe test cards, Zitadel test users.  |

## Worked example: `createUser`

Same scenario, three tiers, same driver methods (full code in
[`packages/web/features/users/__tests__/create-user.integration.test.tsx`](../../../web/features/users/__tests__/create-user.integration.test.tsx)
and
[`packages/acceptance/specs/add-user.spec.ts`](../../../acceptance/specs/add-user.spec.ts)).

```ts
// Presenter (packages/web/features/users/create-user/*.presenter.test.tsx)
const driver = rtlUsersDriver(
  render(<CreateUser />, { wrapper: presenterHarness.wrapper }),
  { getToasts: presenterHarness.getToasts },
);
await driver.createUser(validPayload);
await driver.expectToast("success", "User created!");

// Integration (packages/web/features/users/__tests__/create-user.integration.test.tsx)
server.use(
  ...handlers.auth.signedInAs(makeUser({ role: "admin" })),
  handlers.users.list([]),
  handlers.users.create({ result: "success" }),
);
const rendered = renderWithHarness(<UsersPage />);
const driver = rtlUsersDriver(rendered);
await driver.goto();
await driver.createUser(validPayload);
await driver.expectToast("success", "User created!");

// Acceptance (packages/acceptance/specs/add-user.spec.ts)
const driver = playwrightUsersDriver(page);
await driver.goto();
await driver.createUser(validPayload);
await driver.expectUserInList(validPayload.email);
```

## Tier-ceiling acknowledgement

Not every integration scenario is reproducible at the acceptance
tier. If the setup requires "Stripe has previously declined this
user 3 times in the last 30 days" or "the session is exactly 30 days
old," the scenario stays at the integration tier. Don't build
elaborate test-only production infrastructure to force promotion.
