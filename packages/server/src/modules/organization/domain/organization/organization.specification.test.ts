import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationRootOps } from "./organization.root-ops.js";
import { OrganizationSpecifications } from "./organization.specification.js";

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const later = DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z"));

describe("OrganizationSpecifications.isDeleted / notDeleted", () => {
  it("returns false on a fresh org and true after softDelete", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(OrganizationSpecifications.isDeleted(organization), false);
    deepStrictEqual(OrganizationSpecifications.notDeleted(organization), true);
    const result = OrganizationRootOps.softDelete(organization, { now: later });
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(OrganizationSpecifications.isDeleted(result.success.organization), true);
    deepStrictEqual(OrganizationSpecifications.notDeleted(result.success.organization), false);
  });

  it("carry criteria complementary over deletedAt", () => {
    deepStrictEqual(OrganizationSpecifications.isDeleted.criteria, {
      _tag: "IsNotNull",
      field: "deletedAt",
    });
    deepStrictEqual(OrganizationSpecifications.notDeleted.criteria, {
      _tag: "IsNull",
      field: "deletedAt",
    });
  });
});

describe("OrganizationSpecifications.withId", () => {
  it("matches only the org with the given id and carries an Eq criteria", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    const other = OrganizationId.make("22222222-2222-2222-2222-222222222222");
    deepStrictEqual(OrganizationSpecifications.withId(id)(organization), true);
    deepStrictEqual(OrganizationSpecifications.withId(other)(organization), false);
    deepStrictEqual(OrganizationSpecifications.withId(id).criteria, {
      _tag: "Eq",
      field: "id",
      value: id,
    });
  });
});
