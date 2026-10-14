// Drift gate: each fixture's default output must round-trip through
// the `@org/contracts` schemas (encode → decode). If a contract field
// is added/removed/renamed, this test breaks before any feature test
// does.

import { describe, expect, it } from "@effect/vitest";
import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import { makeCreateOrganizationPayload, makeMyOrganization } from "./organization";

const roundTrip = <A, I>(schema: Schema.Codec<A, I>, value: A) =>
  Effect.flatMap(Schema.encodeEffect(schema)(value), (encoded) =>
    Schema.decodeUnknownEffect(schema)(encoded),
  );

describe("organization fixtures", () => {
  it.effect("makeMyOrganization() round-trips through OrganizationContract.MyOrganization", () =>
    roundTrip(OrganizationContract.MyOrganization, makeMyOrganization()),
  );

  it("makeMyOrganization() honors overrides", () => {
    expect(makeMyOrganization({ name: "Other" }).name).toBe("Other");
  });

  it.effect("makeCreateOrganizationPayload() round-trips through its contract", () =>
    roundTrip(OrganizationContract.CreateOrganizationPayload, makeCreateOrganizationPayload()),
  );
});
