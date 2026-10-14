import { describe, expect, it } from "@effect/vitest";
import { assertNone } from "@effect/vitest/utils";
import * as AuthContract from "@org/contracts/api/AuthContract";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import { deviceHandlers } from "@/test/handlers/device";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import {
  errorsAtom,
  fieldsAtom,
  isApprovedAtom,
  setUserCodeAtom,
  submitAtom,
  submitAttemptedAtom,
  visibleErrorsAtom,
} from "./approve-device.view-model";

const FROM_URL = "ABCD-2345";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const submit = (registry: AtomRegistry.AtomRegistry, initialCode: string) => {
  registry.set(submitAtom(initialCode), void 0);

  return AtomRegistry.getResult(registry, submitAtom(initialCode), { suspendOnWaiting: true });
};

describe("approve device ViewModel", () => {
  it("starts pre-filled with the code the URL carried", () => {
    const registry = makeRegistry();

    expect(registry.get(fieldsAtom(FROM_URL))).toEqual({ userCode: FROM_URL });
    expect(registry.get(errorsAtom(FROM_URL))).toEqual({});
  });

  it("starts empty, and invalid, when the URL carried no code", () => {
    const registry = makeRegistry();

    expect(registry.get(fieldsAtom(""))).toEqual({ userCode: "" });
    expect(registry.get(errorsAtom("")).userCode).toBeTypeOf("string");
  });

  it.effect("keeps the error hidden until the first submit attempt", () =>
    Effect.gen(function* () {
      const registry = makeRegistry();
      expect(registry.get(visibleErrorsAtom(""))).toEqual({});

      yield* submit(registry, "");

      expect(registry.get(submitAttemptedAtom(""))).toBe(true);
      expect(registry.get(visibleErrorsAtom("")).userCode).toBeTypeOf("string");
    }),
  );

  it.effect("does not call the API, or claim success, with no code", () =>
    Effect.gen(function* () {
      // No handler registered: MSW errors on any unhandled request, so a call
      // here would fail the test rather than pass silently.
      const registry = makeRegistry();

      yield* submit(registry, "");

      assertNone(registry.get(notificationAtom));
      expect(registry.get(isApprovedAtom)).toBe(false);
    }),
  );

  it.effect("submits the code the user actually sees, announces it, and stays approved", () =>
    Effect.gen(function* () {
      const submitted: Array<string> = [];
      server.use(
        typedHandler(getEndpoint(AuthContract.DeviceApprovalGroup, "approve"), ({ payload }) => {
          submitted.push(payload.userCode);

          return Effect.void;
        }),
      );

      const registry = makeRegistry();
      registry.set(setUserCodeAtom(FROM_URL), "WXYZ-9876");
      yield* submit(registry, FROM_URL);

      expect(submitted).toEqual(["WXYZ-9876"]);
      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Device approved — return to your terminal.",
      });
      // The confirmation replaces the form, so this outlives the toast.
      expect(registry.get(isApprovedAtom)).toBe(true);
    }),
  );

  it.effect("surfaces an expired code rather than claiming approval", () =>
    Effect.gen(function* () {
      server.use(deviceHandlers.approve({ result: "Gone" }));

      const registry = makeRegistry();
      yield* Effect.exit(submit(registry, FROM_URL));

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "That code has expired.",
      });
      expect(registry.get(isApprovedAtom)).toBe(false);
    }),
  );
});
