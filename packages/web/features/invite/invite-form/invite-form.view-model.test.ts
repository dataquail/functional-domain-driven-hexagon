import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { ORG_A_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import {
  errorsAtom,
  fieldsAtom,
  setEmailAtom,
  submitAtom,
  submitAttemptedAtom,
  visibleErrorsAtom,
} from "./invite-form.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const submit = (registry: AtomRegistry.AtomRegistry) => {
  registry.set(submitAtom, ORG_A_ID);
  return Effect.runPromise(
    AtomRegistry.getResult(registry, submitAtom, { suspendOnWaiting: true }),
  );
};

describe("invite form ViewModel", () => {
  it("rejects an address that is too short to be one, and accepts a real one", () => {
    const registry = makeRegistry();
    expect(registry.get(errorsAtom)?.email).toBeTypeOf("string");

    registry.set(setEmailAtom, "teammate@example.com");
    expect(registry.get(errorsAtom)).toBeNull();
  });

  it("keeps the error hidden until the first submit attempt", async () => {
    const registry = makeRegistry();
    expect(registry.get(visibleErrorsAtom)).toBeNull();

    await submit(registry);

    expect(registry.get(visibleErrorsAtom)?.email).toBeTypeOf("string");
  });

  it("does not call the API, or claim success, when the address is invalid", async () => {
    // No handler registered: MSW errors on any unhandled request, so a call
    // here would fail the test rather than pass silently.
    const registry = makeRegistry();

    await submit(registry);

    expect(registry.get(notificationAtom)).toBeNull();
  });

  it("sends the invitation, announces it, and clears the field", async () => {
    server.use(orgsHandlers.inviteUser());

    const registry = makeRegistry();
    registry.set(setEmailAtom, "teammate@example.com");
    await submit(registry);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Invitation sent.",
    });
    expect(registry.get(fieldsAtom)).toEqual({ email: "" });
    expect(registry.get(submitAttemptedAtom)).toBe(false);
  });

  it("keeps what was typed when the server refuses", async () => {
    server.use(orgsHandlers.inviteUser({ result: "OrganizationNotFoundError" }));

    const registry = makeRegistry();
    registry.set(setEmailAtom, "teammate@example.com");
    await submit(registry).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Org not found.",
    });
    expect(registry.get(fieldsAtom)).toEqual({ email: "teammate@example.com" });
  });
});
