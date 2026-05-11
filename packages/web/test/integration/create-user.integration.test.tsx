// Worked example from Phase 9 of the remediation plan: createUser
// at the integration tier. Same scenario as the presenter test and
// the acceptance spec, same driver methods — only the setup phase
// changes.
//
// What this exercises:
//   - The real CreateUser presenter (TanStack Form orchestration)
//   - The real `useCreateUserMutation` (data-access + useEffectMutation)
//   - The real backend handlers (createUser command, UserCreated
//     event, wallet event adapter, wallet handler, wallet repo
//     insert) — all running in-process over the FakeDatabase.
//
// What this does NOT exercise:
//   - Next.js routing, hydration, or RSC boundaries (the page
//     wrapper is bypassed; we mount the feature components directly)
//   - The real OIDC dance (backend.auth.signInAs short-circuits it)

import { CreateUser } from "@/features/users/create-user/create-user";
import { UserList } from "@/features/users/user-list";
import { makeIntegrationHarness } from "@/test/integration-harness";
import { UserId } from "@org/contracts/EntityIds";
import { startInProcessBackend, type InProcessBackend } from "@org/test-backend";
import { rtlUsersDriver } from "@org/test-drivers/adapters/rtl/users-page-driver";
import { render } from "@testing-library/react";
import * as React from "react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const adminUserId = UserId.make("00000000-0000-0000-0000-000000000001");

let backend: InProcessBackend;
let harness: ReturnType<typeof makeIntegrationHarness>;

beforeEach(async () => {
  backend = await startInProcessBackend({
    signedInAs: { userId: adminUserId },
  });
  harness = makeIntegrationHarness({ transport: backend.fetch });
});

afterEach(async () => {
  await harness.dispose();
  await backend.dispose();
});

const validPayload = {
  email: "alice@example.com",
  country: "USA",
  street: "123 Main St",
  postalCode: "12345",
};

describe("createUser — integration tier (worked example)", () => {
  it("creates a user via the real form + real backend; the wallet event handler auto-creates a wallet", async () => {
    const rendered = render(
      <React.Fragment>
        <CreateUser />
        <UserList />
      </React.Fragment>,
      { wrapper: harness.wrapper },
    );
    const driver = rtlUsersDriver(rendered, { getToasts: harness.getToasts });

    await driver.goto();
    await driver.createUser(validPayload);

    // Success toast confirms the mutation completed end-to-end
    // (FE form → useEffectMutation → /api/users → createUser handler
    // → fake repo → success → toast).
    await driver.expectToast("success", "User created!");

    // Verify the user landed in the FakeDatabase — same Map the
    // backend handler wrote to.
    const users = Array.from(backend.db.users.values());
    expect(users.length).toBe(1);
    expect(users[0]?.email).toBe(validPayload.email);

    // Critical cross-module assertion: the real wallet event
    // adapter ran, translated UserCreated → UserCreatedTrigger,
    // dispatched to the wallet handler, which inserted a wallet
    // via the wallet repository. Cross-module composition under
    // test, end-to-end.
    expect(backend.db.wallets.size).toBe(1);
    const wallet = Array.from(backend.db.wallets.values())[0];
    expect(wallet.userId).toBe(users[0]?.id);
  });
});
