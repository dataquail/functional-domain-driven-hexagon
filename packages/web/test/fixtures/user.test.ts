// Drift gate: each fixture's default output must round-trip through
// the `@org/contracts` schemas (encode → decode). If a contract field
// is added/removed/renamed, this test breaks before any feature test
// does. Fixtures are already-decoded values; we go decoded → encoded →
// decoded to confirm the structural shape is contract-valid.

import { describe, expect, it } from "@effect/vitest";
import * as UserContract from "@org/contracts/api/UserContract";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { makeCreateUserPayload, makePaginatedUsers, makeUser } from "./user";

const roundTrip = <A, I>(schema: Schema.Codec<A, I>, value: A) =>
  Effect.flatMap(Schema.encodeEffect(schema)(value), (encoded) =>
    Schema.decodeUnknownEffect(schema)(encoded),
  );

describe("user fixtures", () => {
  it.effect("makeUser() round-trips through UserContract.User", () =>
    roundTrip(UserContract.User, makeUser()),
  );

  it("makeUser() honors overrides", () => {
    const u = makeUser({ email: "override@example.com" });
    expect(u.email).toBe("override@example.com");
  });

  it.effect("makePaginatedUsers() round-trips through UserContract.PaginatedUsers", () =>
    roundTrip(UserContract.PaginatedUsers, makePaginatedUsers()),
  );

  it("makePaginatedUsers() defaults total to users.length", () => {
    const page = makePaginatedUsers({ users: [makeUser(), makeUser({ id: makeUser().id })] });
    expect(page.total).toBe(2);
  });

  it.effect("makeCreateUserPayload() round-trips through UserContract.CreateUserPayload", () =>
    roundTrip(UserContract.CreateUserPayload, makeCreateUserPayload()),
  );
});
