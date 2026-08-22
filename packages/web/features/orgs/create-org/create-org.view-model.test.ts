import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { navigationRequestAtom } from "@/services/atom/navigation.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import {
  errorsAtom,
  fieldsAtom,
  setNameAtom,
  submitAtom,
  submitAttemptedAtom,
  visibleErrorsAtom,
} from "./create-org.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const submit = (registry: AtomRegistry.AtomRegistry) => {
  registry.set(submitAtom, undefined);
  return Effect.runPromise(
    AtomRegistry.getResult(registry, submitAtom, { suspendOnWaiting: true }),
  );
};

describe("create org ViewModel", () => {
  it("rejects a blank name and accepts a filled one", () => {
    const registry = makeRegistry();
    expect(registry.get(errorsAtom)?.name).toBeTypeOf("string");

    registry.set(setNameAtom, "Acme Inc.");
    expect(registry.get(errorsAtom)).toBeNull();
  });

  it("keeps the error hidden until the first submit attempt", async () => {
    const registry = makeRegistry();
    expect(registry.get(visibleErrorsAtom)).toBeNull();

    await submit(registry);

    expect(registry.get(visibleErrorsAtom)?.name).toBeTypeOf("string");
  });

  it("does not call the API, announce, or navigate when the name is blank", async () => {
    // No handler registered: MSW errors on any unhandled request, so a call
    // here would fail the test rather than pass silently.
    const registry = makeRegistry();

    await submit(registry);

    expect(registry.get(notificationAtom)).toBeNull();
    expect(registry.get(navigationRequestAtom)).toBeNull();
  });

  it("creates the org, announces it, clears the form, and moves into the new org", async () => {
    server.use(orgsHandlers.create({ result: "success", id: ORG_B_ID }));

    const registry = makeRegistry();
    registry.set(setNameAtom, "Acme Inc.");
    await submit(registry);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Organization created!",
    });
    expect(registry.get(fieldsAtom)).toEqual({ name: "" });
    expect(registry.get(submitAttemptedAtom)).toBe(false);
    expect(registry.get(navigationRequestAtom)?.href).toBe(`/orgs/${ORG_B_ID}`);
  });

  it("stays put and keeps what was typed when the server refuses", async () => {
    server.use(orgsHandlers.create({ result: "SuperAdminCannotOwnOrganizationError" }));

    const registry = makeRegistry();
    registry.set(setNameAtom, "Acme Inc.");
    await submit(registry).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({ kind: "error" });
    expect(registry.get(fieldsAtom)).toEqual({ name: "Acme Inc." });
    expect(registry.get(navigationRequestAtom)).toBeNull();
  });
});
