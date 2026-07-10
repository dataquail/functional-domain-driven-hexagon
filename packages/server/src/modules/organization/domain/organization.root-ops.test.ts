import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as DateTime from "effect/DateTime";
import * as Result from "effect/Result";

import { OrganizationId } from "@/platform/ids/organization-id.js";

import { OrganizationAlreadyDeleted, OrganizationNotDeleted } from "./organization.errors.js";
import { type OrganizationEvent } from "./organization.events.js";
import { OrganizationRootOps } from "./organization.root-ops.js";

const id = OrganizationId.make("11111111-1111-1111-1111-111111111111");
const now = DateTime.makeUnsafe(new Date("2026-01-01T00:00:00Z"));
const later = DateTime.makeUnsafe(new Date("2026-02-01T00:00:00Z"));

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

describe("OrganizationRootOps.create", () => {
  it("sets id, name, timestamps; deletedAt is null", () => {
    const { organization } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(organization.id, id);
    deepStrictEqual(organization.name, "Acme");
    deepStrictEqual(organization.createdAt, now);
    deepStrictEqual(organization.updatedAt, now);
    deepStrictEqual(organization.deletedAt, null);
  });

  it("emits OrganizationCreated", () => {
    const { events } = OrganizationRootOps.create({ id, name: "Acme", now });
    deepStrictEqual(events.length, 1);
    const event = expectEvent(events, "OrganizationCreated");
    deepStrictEqual(event.organizationId, id);
    deepStrictEqual(event.name, "Acme");
  });
});

describe("OrganizationRootOps.softDelete", () => {
  const seed = () => OrganizationRootOps.create({ id, name: "Acme", now }).organization;

  it("sets deletedAt and updatedAt; emits OrganizationSoftDeleted", () => {
    const result = OrganizationRootOps.softDelete(seed(), { now: later });
    if (Result.isFailure(result)) throw new Error("expected Right");
    deepStrictEqual(result.success.organization.deletedAt, later);
    deepStrictEqual(result.success.organization.updatedAt, later);
    const event = expectEvent(result.success.events, "OrganizationSoftDeleted");
    deepStrictEqual(event.organizationId, id);
  });

  it("fails OrganizationAlreadyDeleted when the org is already soft-deleted", () => {
    const first = OrganizationRootOps.softDelete(seed(), { now: later });
    if (Result.isFailure(first)) throw new Error("expected Right");
    const second = OrganizationRootOps.softDelete(first.success.organization, { now: later });
    deepStrictEqual(Result.isFailure(second), true);
    if (Result.isFailure(second)) {
      deepStrictEqual(second.failure instanceof OrganizationAlreadyDeleted, true);
    }
  });
});

describe("OrganizationRootOps.restore", () => {
  const seed = () => OrganizationRootOps.create({ id, name: "Acme", now }).organization;
  const deleted = () => {
    const result = OrganizationRootOps.softDelete(seed(), { now: later });
    if (Result.isFailure(result)) throw new Error("expected Right");
    return result.success.organization;
  };

  it("clears deletedAt and emits OrganizationRestored", () => {
    const restored = OrganizationRootOps.restore(deleted(), { now: later });
    if (Result.isFailure(restored)) throw new Error("expected Right");
    deepStrictEqual(restored.success.organization.deletedAt, null);
    const event = expectEvent(restored.success.events, "OrganizationRestored");
    deepStrictEqual(event.organizationId, id);
  });

  it("fails OrganizationNotDeleted when the org isn't deleted", () => {
    const result = OrganizationRootOps.restore(seed(), { now: later });
    deepStrictEqual(Result.isFailure(result), true);
    if (Result.isFailure(result)) {
      deepStrictEqual(result.failure instanceof OrganizationNotDeleted, true);
    }
  });
});
