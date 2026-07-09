import * as Schema from "effect/Schema";

export const DeviceGrantId = Schema.String.check(Schema.isGUID()).pipe(
  Schema.brand("DeviceGrantId"),
);
export type DeviceGrantId = typeof DeviceGrantId.Type;
