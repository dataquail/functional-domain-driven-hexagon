import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { makeCreateUserPayload } from "@/test/fixtures/user";
import { usersHandlers } from "@/test/handlers/users";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import {
  type CreateUserFields,
  errorsAtom,
  fieldsAtom,
  setFieldAtom,
  submitAtom,
  submitAttemptedAtom,
  visibleErrorsAtom,
} from "./create-user.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const VALID: CreateUserFields = {
  email: makeCreateUserPayload().email,
  country: "US",
  street: "2 B St",
  postalCode: "10002",
};

const submit = (registry: AtomRegistry.AtomRegistry) => {
  registry.set(submitAtom, void 0);

  return AtomRegistry.getResult(registry, submitAtom, { suspendOnWaiting: true });
};

describe("create user ViewModel", () => {
  it("edits one field without disturbing the others", () => {
    const registry = makeRegistry();
    registry.set(setFieldAtom, { field: "email", value: "ada@example.com" });
    registry.set(setFieldAtom, { field: "country", value: "GB" });

    expect(registry.get(fieldsAtom)).toEqual({
      email: "ada@example.com",
      country: "GB",
      street: "",
      postalCode: "",
    });
  });

  it("reports an error per unsatisfied contract field, and none once satisfied", () => {
    const registry = makeRegistry();
    expect(Object.keys(registry.get(errorsAtom)).sort()).toEqual([
      "country",
      "email",
      "postalCode",
      "street",
    ]);

    registry.set(fieldsAtom, VALID);
    expect(registry.get(errorsAtom)).toEqual({});
  });

  it.effect("keeps errors hidden until the first submit attempt", () =>
    Effect.gen(function* () {
      const registry = makeRegistry();
      registry.set(setFieldAtom, { field: "email", value: "a" });

      expect(registry.get(visibleErrorsAtom)).toEqual({});

      yield* submit(registry);

      expect(registry.get(submitAttemptedAtom)).toBe(true);
      expect(registry.get(visibleErrorsAtom).email).toBeTypeOf("string");
    }),
  );

  it.effect("does not call the API, or claim success, when validation fails", () =>
    Effect.gen(function* () {
      // No handler registered: MSW errors on any unhandled request, so a call
      // here would fail the test rather than pass silently.
      const registry = makeRegistry();
      registry.set(setFieldAtom, { field: "email", value: "a" });

      yield* submit(registry);

      assertNone(registry.get(notificationAtom));
    }),
  );

  it.effect("creates the user, announces it, and clears the form", () =>
    Effect.gen(function* () {
      server.use(usersHandlers.create({ result: "success" }));

      const registry = makeRegistry();
      registry.set(fieldsAtom, VALID);
      yield* submit(registry);

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "User created!",
      });
      expect(registry.get(fieldsAtom)).toEqual({
        email: "",
        country: "",
        street: "",
        postalCode: "",
      });
      expect(registry.get(submitAttemptedAtom)).toBe(false);
    }),
  );

  it.effect("surfaces a duplicate-email failure and keeps what the user typed", () =>
    Effect.gen(function* () {
      server.use(
        usersHandlers.create({ result: "UserAlreadyExistsError", message: "That email is taken." }),
      );

      const registry = makeRegistry();
      registry.set(fieldsAtom, VALID);
      yield* Effect.exit(submit(registry));

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "That email is taken.",
      });
      expect(registry.get(fieldsAtom)).toEqual(VALID);
    }),
  );
});
