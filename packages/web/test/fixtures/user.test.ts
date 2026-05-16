// Drift gate: each fixture's default output must round-trip through
// the `@org/contracts` schemas (encode → decode). If a contract field
// is added/removed/renamed, this test breaks before any feature test
// does. Fixtures are already-decoded values; we go decoded → encoded →
// decoded to confirm the structural shape is contract-valid.

import * as UserContract from "@org/contracts/api/UserContract";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vitest";
import { makeCreateUserPayload, makePaginatedUsers, makeUser } from "./user";

const roundTrip = <A, I>(schema: Schema.Schema<A, I>, value: A) =>
  Effect.runPromise(
    Effect.flatMap(Schema.encode(schema)(value), (encoded) =>
      Schema.decodeUnknown(schema)(encoded),
    ),
  );

describe("user fixtures", () => {
  it("makeUser() round-trips through UserContract.User", async () => {
    await expect(roundTrip(UserContract.User, makeUser())).resolves.toBeDefined();
  });

  it("makeUser() honors overrides", () => {
    const u = makeUser({ email: "override@example.com", role: "admin" });
    expect(u.email).toBe("override@example.com");
    expect(u.role).toBe("admin");
  });

  it("makePaginatedUsers() round-trips through UserContract.PaginatedUsers", async () => {
    await expect(
      roundTrip(UserContract.PaginatedUsers, makePaginatedUsers()),
    ).resolves.toBeDefined();
  });

  it("makePaginatedUsers() defaults total to users.length", () => {
    const page = makePaginatedUsers({ users: [makeUser(), makeUser({ id: makeUser().id })] });
    expect(page.total).toBe(2);
  });

  it("makeCreateUserPayload() round-trips through UserContract.CreateUserPayload", async () => {
    await expect(
      roundTrip(UserContract.CreateUserPayload, makeCreateUserPayload()),
    ).resolves.toBeDefined();
  });
});
