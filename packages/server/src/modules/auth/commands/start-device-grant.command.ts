import { Command, PersistenceUnavailable } from "@org/cqrs";
import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

// The plaintext `deviceCode` is returned to the CLI once (it holds it and
// polls with it); only its hash is persisted. `userCode` is what the human
// types in the browser.
export type StartDeviceGrantResult = {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly expiresAt: DateTime.Utc;
};

export const StartDeviceGrantResultView = Schema.Struct({
  deviceCode: Schema.String,
  userCode: Schema.String,
  expiresAt: Schema.DateTimeUtc,
});

// Begins a device authorization grant. `ttlSeconds` is resolved by the
// endpoint from config so the handler computes `expiresAt` against the
// server clock.
export const StartDeviceGrantCommand = Command.make("StartDeviceGrantCommand", {
  payload: { ttlSeconds: Schema.Number },
  success: StartDeviceGrantResultView,
  failure: PersistenceUnavailable,
});
export type StartDeviceGrantPayload = Command.Payload<typeof StartDeviceGrantCommand>;
