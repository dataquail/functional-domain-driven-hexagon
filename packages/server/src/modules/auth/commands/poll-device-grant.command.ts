import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// CLI poll: exchange a device code for an app token once the grant is
// approved. `tokenExpiresInDays` is resolved by the endpoint from config.
export const PollDeviceGrantCommand = Schema.TaggedStruct("PollDeviceGrantCommand", {
  deviceCode: Schema.String,
  tokenExpiresInDays: Schema.Number,
});
export type PollDeviceGrantCommand = typeof PollDeviceGrantCommand.Type;

// Deliberately empty: `deviceCode` is secret-derived and must not land in a span.
export const pollDeviceGrantCommandSpanAttributes: SpanAttributesExtractor<
  PollDeviceGrantCommand
> = () => ({});
