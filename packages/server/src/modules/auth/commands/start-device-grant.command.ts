import type * as DateTime from "effect/DateTime";
import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Begins a device authorization grant. `ttlSeconds` is resolved by the
// endpoint from config so the handler computes `expiresAt` against the
// server clock.
export const StartDeviceGrantCommand = Schema.TaggedStruct("StartDeviceGrantCommand", {
  ttlSeconds: Schema.Number,
});
export type StartDeviceGrantCommand = typeof StartDeviceGrantCommand.Type;

export const startDeviceGrantCommandSpanAttributes: SpanAttributesExtractor<
  StartDeviceGrantCommand
> = () => ({});

// The plaintext `deviceCode` is returned to the CLI once (it holds it and
// polls with it); only its hash is persisted. `userCode` is what the human
// types in the browser.
export type StartDeviceGrantResult = {
  readonly deviceCode: string;
  readonly userCode: string;
  readonly expiresAt: DateTime.Utc;
};
