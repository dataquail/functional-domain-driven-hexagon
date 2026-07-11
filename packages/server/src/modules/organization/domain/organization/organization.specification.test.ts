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

describe("OrganizationSpecifications.isDeleted", () => {
  it("returns false on a fresh org and true after softDelete", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(OrganizationSpecifications.isDeleted(organization), false);
    const result = OrganizationRootOps.softDelete(organization, { now: later });
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(OrganizationSpecifications.isDeleted(result.success.organization), true);
  });
});
