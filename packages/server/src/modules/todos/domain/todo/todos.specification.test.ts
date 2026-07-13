import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { TodoId } from "./todo.id.js";
import { TodoRootOps } from "./todo.root-ops.js";
import { TodoSpecifications } from "./todos.specification.js";

const aliceId = TodoId.make("11111111-1111-1111-1111-111111111111");
const bobId = TodoId.make("22222222-2222-2222-2222-222222222222");
const orgId = OrganizationId.make("aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa");
const otherOrgId = OrganizationId.make("bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb");
const now = DateTime.makeUnsafe(new Date("2025-01-01T00:00:00Z"));

const buyMilk = TodoRootOps.create({ id: aliceId, organizationId: orgId, title: "Buy milk", now });

describe("TodoSpecifications.withId", () => {
  it("matches the todo with the given id and no other", () => {
    deepStrictEqual(TodoSpecifications.withId(aliceId)(buyMilk), true);
    deepStrictEqual(TodoSpecifications.withId(bobId)(buyMilk), false);
  });

  it("carries an Eq criteria over the id column", () => {
    deepStrictEqual(TodoSpecifications.withId(aliceId).criteria, {
      _tag: "Eq",
      field: "id",
      value: aliceId,
    });
  });
});

describe("TodoSpecifications.forOrganization", () => {
  it("matches the todo owned by the given org and no other", () => {
    deepStrictEqual(TodoSpecifications.forOrganization(orgId)(buyMilk), true);
    deepStrictEqual(TodoSpecifications.forOrganization(otherOrgId)(buyMilk), false);
  });

  it("carries an Eq criteria over the organization_id column", () => {
    deepStrictEqual(TodoSpecifications.forOrganization(orgId).criteria, {
      _tag: "Eq",
      field: "organizationId",
      value: orgId,
    });
  });
});
