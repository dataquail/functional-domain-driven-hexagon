import * as Schema from "effect/Schema";

// Module-internal id for an `ApiToken`, mirroring `SessionId`. The
// contract exposes a structurally-compatible `ApiTokenId` brand
// (`@org/contracts/EntityIds`) for the wire types; both resolve to
// `string & Brand<"ApiTokenId">`, so a domain id flows into a contract
// field without a cast.
export const ApiTokenId = Schema.String.check(Schema.isUUID()).pipe(Schema.brand("ApiTokenId"));
export type ApiTokenId = typeof ApiTokenId.Type;
