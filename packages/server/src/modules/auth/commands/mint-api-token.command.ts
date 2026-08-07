import { Command, PersistenceUnavailable } from "@org/cqrs";
import * as Schema from "effect/Schema";

import { ApiTokenRoot } from "@/modules/auth/domain/api-token/api-token.root.js";
import { UserId } from "@/platform/ids/user-id.js";

// The resolved inputs the mint core needs. The command is one source of
// these; the device-flow poll is another (it mints on the user's behalf).
export type MintApiTokenInput = {
  readonly userId: UserId;
  readonly label: string;
  readonly expiresInDays: number;
};

// The plaintext `token` is returned to the caller exactly once (the endpoint
// surfaces it); only its hash is persisted on `apiToken`.
export type MintApiTokenResult = {
  readonly apiToken: ApiTokenRoot;
  readonly token: string;
};

// The plaintext token travels by reference and is never encoded, so declaring it here
// does not put a secret on any wire.
export const MintApiTokenResultView = Schema.Struct({
  apiToken: ApiTokenRoot,
  token: Schema.String,
});

// Mints a new API token for the caller. `expiresInDays` is resolved by the
// endpoint (payload value or the configured default) so the handler can
// compute `expiresAt` against the server clock — no client/server skew.
export const MintApiTokenCommand = Command.make("MintApiTokenCommand", {
  payload: { userId: UserId, label: Schema.String, expiresInDays: Schema.Number },
  success: MintApiTokenResultView,
  failure: PersistenceUnavailable,
});
export type MintApiTokenPayload = Command.Payload<typeof MintApiTokenCommand>;
