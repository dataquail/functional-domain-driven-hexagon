import { Command } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { ApproveDeviceGrantCommand } from "@/modules/auth/commands/approve-device-grant.command.ts";
import { approveDeviceGrantHandler } from "@/modules/auth/commands/approve-device-grant.handler.ts";
import { MintApiTokenCommand } from "@/modules/auth/commands/mint-api-token.command.ts";
import { mintApiTokenHandler } from "@/modules/auth/commands/mint-api-token.handler.ts";
import { PollDeviceGrantCommand } from "@/modules/auth/commands/poll-device-grant.command.ts";
import { pollDeviceGrantHandler } from "@/modules/auth/commands/poll-device-grant.handler.ts";
import { RevokeApiTokenCommand } from "@/modules/auth/commands/revoke-api-token.command.ts";
import { revokeApiTokenHandler } from "@/modules/auth/commands/revoke-api-token.handler.ts";
import { RevokeSessionCommand } from "@/modules/auth/commands/revoke-session.command.ts";
import { revokeSessionHandler } from "@/modules/auth/commands/revoke-session.handler.ts";
import { SignInCommand } from "@/modules/auth/commands/sign-in.command.ts";
import { signInHandler } from "@/modules/auth/commands/sign-in.handler.ts";
import { StartDeviceGrantCommand } from "@/modules/auth/commands/start-device-grant.command.ts";
import { startDeviceGrantHandler } from "@/modules/auth/commands/start-device-grant.handler.ts";
import { TouchApiTokenCommand } from "@/modules/auth/commands/touch-api-token.command.ts";
import { touchApiTokenHandler } from "@/modules/auth/commands/touch-api-token.handler.ts";
import { TouchSessionCommand } from "@/modules/auth/commands/touch-session.command.ts";
import { touchSessionHandler } from "@/modules/auth/commands/touch-session.handler.ts";
import { UserProvisioningLive } from "@/modules/auth/infrastructure/acl/user-provisioning.acl-live.ts";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.ts";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/repositories/auth-identity.repository-live.ts";
import { DeviceGrantRepositoryLive } from "@/modules/auth/infrastructure/repositories/device-grant.repository-live.ts";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live.ts";

// `UserProvisioningLive` is provided here rather than at the composition root: only a
// dispatch surface can absorb its own outbound adapter, because `handlersOf` infers the
// user-module requirement it carries where a hand-written output type would force this
// module to name it. Provisioning joins sign-in's transaction (ADR-0007 +
// `UnitOfWorkLive` re-entrancy), which is why it is a dispatched command rather than an
// event reaction.
export const authCommandGroup = Command.group(
  SignInCommand,
  TouchSessionCommand,
  RevokeSessionCommand,
  MintApiTokenCommand,
  RevokeApiTokenCommand,
  TouchApiTokenCommand,
  StartDeviceGrantCommand,
  ApproveDeviceGrantCommand,
  PollDeviceGrantCommand,
);

const AuthCommandHandlersLive = Command.handlersOf(authCommandGroup, {
  SignInCommand: (payload) =>
    signInHandler(payload).pipe(
      Effect.provide(Layer.mergeAll(AuthIdentityRepositoryLive, SessionRepositoryLive)),
    ),
  TouchSessionCommand: (payload) =>
    touchSessionHandler(payload).pipe(Effect.provide(SessionRepositoryLive)),
  RevokeSessionCommand: (payload) =>
    revokeSessionHandler(payload).pipe(Effect.provide(SessionRepositoryLive)),
  MintApiTokenCommand: (payload) =>
    mintApiTokenHandler(payload).pipe(Effect.provide(ApiTokenRepositoryLive)),
  RevokeApiTokenCommand: (payload) =>
    revokeApiTokenHandler(payload).pipe(Effect.provide(ApiTokenRepositoryLive)),
  TouchApiTokenCommand: (payload) =>
    touchApiTokenHandler(payload).pipe(Effect.provide(ApiTokenRepositoryLive)),
  StartDeviceGrantCommand: (payload) =>
    startDeviceGrantHandler(payload).pipe(Effect.provide(DeviceGrantRepositoryLive)),
  ApproveDeviceGrantCommand: (payload) =>
    approveDeviceGrantHandler(payload).pipe(Effect.provide(DeviceGrantRepositoryLive)),
  PollDeviceGrantCommand: (payload) =>
    pollDeviceGrantHandler(payload).pipe(
      Effect.provide(Layer.mergeAll(DeviceGrantRepositoryLive, ApiTokenRepositoryLive)),
    ),
}).pipe(Layer.provide(UserProvisioningLive));

// Three payload fields are deliberately absent: the issuer's `subject` is opaque but still
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
