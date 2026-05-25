import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Either from "effect/Either";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import * as Organization from "./organization.aggregate.js";
import { OrganizationAlreadyDeleted, OrganizationNotDeleted } from "./organization-errors.js";
import { type OrganizationEvent } from "./organization-events.js";

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.unsafeMake(new Date("2026-01-01T00:00:00Z"));
const later = DateTime.unsafeMake(new Date("2026-02-01T00:00:00Z"));

const expectEvent = <T extends OrganizationEvent["_tag"]>(
  events: ReadonlyArray<OrganizationEvent>,
  tag: T,
): Extract<OrganizationEvent, { _tag: T }> => {
  const event = events[0];
  if (event?._tag !== tag) {
    throw new Error(`expected ${tag}, got ${String(event?._tag)}`);
  }
  return event as Extract<OrganizationEvent, { _tag: T }>;
};

describe("Organization.create", () => {
  it("sets id, name, timestamps; deletedAt is null", () => {
    const { organization } = Organization.create({ id, name: "Acme", now });
    deepStrictEqual(organization.id, id);
    deepStrictEqual(organization.name, "Acme");
    deepStrictEqual(organization.createdAt, now);
    deepStrictEqual(organization.updatedAt, now);
    deepStrictEqual(organization.deletedAt, null);
  });

  it("emits OrganizationCreated", () => {
    const { events } = Organization.create({ id, name: "Acme", now });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "OrganizationCreated");
    deepStrictEqual(event.organizationId, id);
    deepStrictEqual(event.name, "Acme");
  });
});

describe("Organization.softDelete", () => {
  const seed = () => Organization.create({ id, name: "Acme", now }).organization;

  it("sets deletedAt and updatedAt; emits OrganizationSoftDeleted", () => {
    const result = Organization.softDelete(seed(), { now: later });
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(result.right.organization.deletedAt, later);
    deepStrictEqual(result.right.organization.updatedAt, later);
    const event = expectEvent(result.right.events, "OrganizationSoftDeleted");
    deepStrictEqual(event.organizationId, id);
  });

  it("fails OrganizationAlreadyDeleted when the org is already soft-deleted", () => {
    const first = Organization.softDelete(seed(), { now: later });
    if (Either.isLeft(first)) throw new Error("expected Right");
    const second = Organization.softDelete(first.right.organization, { now: later });
    deepStrictEqual(Either.isLeft(second), true);
    if (Either.isLeft(second)) {
      deepStrictEqual(second.left instanceof OrganizationAlreadyDeleted, true);
    }
  });
});

describe("Organization.restore", () => {
  const seed = () => Organization.create({ id, name: "Acme", now }).organization;
  const deleted = () => {
    const result = Organization.softDelete(seed(), { now: later });
    if (Either.isLeft(result)) throw new Error("expected Right");
    return result.right.organization;
  };

  it("clears deletedAt and emits OrganizationRestored", () => {
    const restored = Organization.restore(deleted(), { now: later });
    if (Either.isLeft(restored)) throw new Error("expected Right");
    deepStrictEqual(restored.right.organization.deletedAt, null);
    const event = expectEvent(restored.right.events, "OrganizationRestored");
    deepStrictEqual(event.organizationId, id);
  });

  it("fails OrganizationNotDeleted when the org isn't deleted", () => {
    const result = Organization.restore(seed(), { now: later });
    deepStrictEqual(Either.isLeft(result), true);
    if (Either.isLeft(result)) {
      deepStrictEqual(result.left instanceof OrganizationNotDeleted, true);
    }
  });
});

describe("Organization.isDeleted", () => {
  it("returns false on a fresh org and true after softDelete", () => {
    const { organization } = Organization.create({ id, name: "Acme", now });
    deepStrictEqual(Organization.isDeleted(organization), false);
    const result = Organization.softDelete(organization, { now: later });
    if (Either.isLeft(result)) throw new Error("expected Right");
    deepStrictEqual(Organization.isDeleted(result.right.organization), true);
  });
});
