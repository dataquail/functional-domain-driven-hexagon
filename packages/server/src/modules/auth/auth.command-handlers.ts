import { Command } from "@org/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ApproveDeviceGrant } from "@/modules/auth/commands/approve-device-grant.command.js";
import { approveDeviceGrant } from "@/modules/auth/commands/approve-device-grant.handler.js";
import { MintApiToken } from "@/modules/auth/commands/mint-api-token.command.js";
import { mintApiToken } from "@/modules/auth/commands/mint-api-token.handler.js";
import { PollDeviceGrant } from "@/modules/auth/commands/poll-device-grant.command.js";
import { pollDeviceGrant } from "@/modules/auth/commands/poll-device-grant.handler.js";
import { RevokeApiToken } from "@/modules/auth/commands/revoke-api-token.command.js";
import { revokeApiToken } from "@/modules/auth/commands/revoke-api-token.handler.js";
import { RevokeSession } from "@/modules/auth/commands/revoke-session.command.js";
import { revokeSession } from "@/modules/auth/commands/revoke-session.handler.js";
import { SignIn } from "@/modules/auth/commands/sign-in.command.js";
import { signIn } from "@/modules/auth/commands/sign-in.handler.js";
import { StartDeviceGrant } from "@/modules/auth/commands/start-device-grant.command.js";
import { startDeviceGrant } from "@/modules/auth/commands/start-device-grant.handler.js";
import { TouchApiToken } from "@/modules/auth/commands/touch-api-token.command.js";
import { touchApiToken } from "@/modules/auth/commands/touch-api-token.handler.js";
import { TouchSession } from "@/modules/auth/commands/touch-session.command.js";
import { touchSession } from "@/modules/auth/commands/touch-session.handler.js";
import { UserProvisioningLive } from "@/modules/auth/infrastructure/acl/user-provisioning.acl-live.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/repositories/auth-identity.repository-live.js";
import { DeviceGrantRepositoryLive } from "@/modules/auth/infrastructure/repositories/device-grant.repository-live.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live.js";

// `UserProvisioningLive` is provided here rather than at the composition root: only a
// dispatch surface can absorb its own outbound adapter, because `handlersOf` infers the
// user-module requirement it carries where a hand-written output type would force this
// module to name it. Provisioning joins sign-in's transaction (ADR-0007 +
// `UnitOfWorkLive` re-entrancy), which is why it is a dispatched command rather than an
// event reaction.
const authCommandGroup = Command.group(
  SignIn,
  TouchSession,
  RevokeSession,
  MintApiToken,
  RevokeApiToken,
  TouchApiToken,
  StartDeviceGrant,
  ApproveDeviceGrant,
  PollDeviceGrant,
);

const AuthCommandHandlersLive = Command.handlersOf(authCommandGroup, {
  SignInCommand: (payload) =>
    signIn(payload).pipe(
      Effect.provide(Layer.mergeAll(AuthIdentityRepositoryLive, SessionRepositoryLive)),
    ),
  TouchSessionCommand: (payload) =>
    touchSession(payload).pipe(Effect.provide(SessionRepositoryLive)),
  RevokeSessionCommand: (payload) =>
    revokeSession(payload).pipe(Effect.provide(SessionRepositoryLive)),
  MintApiTokenCommand: (payload) =>
    mintApiToken(payload).pipe(Effect.provide(ApiTokenRepositoryLive)),
  RevokeApiTokenCommand: (payload) =>
    revokeApiToken(payload).pipe(Effect.provide(ApiTokenRepositoryLive)),
  TouchApiTokenCommand: (payload) =>
    touchApiToken(payload).pipe(Effect.provide(ApiTokenRepositoryLive)),
  StartDeviceGrantCommand: (payload) =>
    startDeviceGrant(payload).pipe(Effect.provide(DeviceGrantRepositoryLive)),
  ApproveDeviceGrantCommand: (payload) =>
    approveDeviceGrant(payload).pipe(Effect.provide(DeviceGrantRepositoryLive)),
  PollDeviceGrantCommand: (payload) =>
    pollDeviceGrant(payload).pipe(
      Effect.provide(Layer.mergeAll(DeviceGrantRepositoryLive, ApiTokenRepositoryLive)),
    ),
}).pipe(Layer.provide(UserProvisioningLive));

// Three payload fields are deliberately absent: Zitadel's `subject` is opaque but still
// user-correlatable, and `userCode`/`deviceCode` are bearer credentials. Each handler
// annotates the resolved ids itself, which is post-redaction and safe.
const authCommandSpanAttributes: Command.SpanAttributes<typeof authCommandGroup> = {
  TouchSessionCommand: (payload) => ({ "auth.session.id": payload.sessionId }),
  RevokeSessionCommand: (payload) => ({ "auth.session.id": payload.sessionId }),
  MintApiTokenCommand: (payload) => ({ "user.id": payload.userId }),
  RevokeApiTokenCommand: (payload) => ({
    "auth.api_token.id": payload.apiTokenId,
    "user.id": payload.userId,
  }),
  TouchApiTokenCommand: (payload) => ({ "auth.api_token.id": payload.apiTokenId }),
  ApproveDeviceGrantCommand: (payload) => ({ "user.id": payload.userId }),
};

// This module's slice of the write-side dispatch surface. See `WalletCommands` for why a
// module publishes its own surface rather than letting consumers name the bus.
export class AuthCommands extends Context.Service<
  AuthCommands,
  Command.Dispatcher<typeof authCommandGroup>
>()("@org/server/auth/AuthCommands") {}

export const AuthCommandsLive = Layer.effect(
  AuthCommands,
  Command.dispatcher(authCommandGroup, { spanAttributes: authCommandSpanAttributes }),
).pipe(Layer.provide(AuthCommandHandlersLive));
