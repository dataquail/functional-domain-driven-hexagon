import * as Schema from "effect/Schema";

export const DeviceGrantId = Schema.UUID.pipe(Schema.brand("DeviceGrantId"));
export type DeviceGrantId = typeof DeviceGrantId.Type;
