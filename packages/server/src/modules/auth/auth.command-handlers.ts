import type * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import {
  type ApproveDeviceGrantCommand,
  approveDeviceGrantCommandSpanAttributes,
} from "@/modules/auth/commands/approve-device-grant.command.js";
import { approveDeviceGrant } from "@/modules/auth/commands/approve-device-grant.handler.js";
import {
  type MintApiTokenCommand,
  mintApiTokenCommandSpanAttributes,
  type MintApiTokenResult,
} from "@/modules/auth/commands/mint-api-token.command.js";
import { mintApiToken } from "@/modules/auth/commands/mint-api-token.handler.js";
import {
  type PollDeviceGrantCommand,
  pollDeviceGrantCommandSpanAttributes,
} from "@/modules/auth/commands/poll-device-grant.command.js";
import { pollDeviceGrant } from "@/modules/auth/commands/poll-device-grant.handler.js";
import {
  type RevokeApiTokenCommand,
  revokeApiTokenCommandSpanAttributes,
} from "@/modules/auth/commands/revoke-api-token.command.js";
import { revokeApiToken } from "@/modules/auth/commands/revoke-api-token.handler.js";
import {
  type RevokeSessionCommand,
  revokeSessionCommandSpanAttributes,
} from "@/modules/auth/commands/revoke-session.command.js";
import { revokeSession } from "@/modules/auth/commands/revoke-session.handler.js";
import {
  type SignInCommand,
  signInCommandSpanAttributes,
  type SignInResult,
} from "@/modules/auth/commands/sign-in.command.js";
import { signIn } from "@/modules/auth/commands/sign-in.handler.js";
import {
  type StartDeviceGrantCommand,
  startDeviceGrantCommandSpanAttributes,
  type StartDeviceGrantResult,
} from "@/modules/auth/commands/start-device-grant.command.js";
import { startDeviceGrant } from "@/modules/auth/commands/start-device-grant.handler.js";
import {
  type TouchApiTokenCommand,
  touchApiTokenCommandSpanAttributes,
} from "@/modules/auth/commands/touch-api-token.command.js";
import { touchApiToken } from "@/modules/auth/commands/touch-api-token.handler.js";
import {
  type TouchSessionCommand,
  touchSessionCommandSpanAttributes,
} from "@/modules/auth/commands/touch-session.command.js";
import { touchSession } from "@/modules/auth/commands/touch-session.handler.js";
import { type ApiTokenNotFound } from "@/modules/auth/domain/api-token.errors.js";
import {
  type DeviceGrantExpired,
  type DeviceGrantNotFound,
  type DeviceGrantPending,
} from "@/modules/auth/domain/device-grant.errors.js";
import { ApiTokenRepositoryLive } from "@/modules/auth/infrastructure/repositories/api-token.repository-live.js";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/repositories/auth-identity.repository-live.js";
import { DeviceGrantRepositoryLive } from "@/modules/auth/infrastructure/repositories/device-grant.repository-live.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/repositories/session.repository-live.js";
import { type PersistenceUnavailable } from "@/platform/ddd/contracts/persistence-unavailable.js";
import { commandHandlers } from "@/platform/ddd/ports/command-bus.js";
import { type UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { type UserProvisioning } from "@/platform/ddd/ports/user-provisioning.js";

// `UnitOfWork` + `UserProvisioning` are not provided by the handler wrap
// (only the two repositories are); they're satisfied from the composition-
// root context, so they remain in the bus output's residual R alongside
// `Database`.
type SignInBusOutput = Effect.Effect<
  SignInResult,
  CustomHttpApiError.Unauthorized | PersistenceUnavailable,
  Database.Database | UnitOfWork | UserProvisioning
>;

type TouchSessionBusOutput = Effect.Effect<void, never, Database.Database>;

type RevokeSessionBusOutput = Effect.Effect<void, never, Database.Database>;

// Mint/revoke run in a unit of work; the repository wrap discharges
// `ApiTokenRepository`, leaving `Database` (its dependency) + `UnitOfWork`.
type MintApiTokenBusOutput = Effect.Effect<
  MintApiTokenResult,
  PersistenceUnavailable,
  Database.Database | UnitOfWork
>;

type RevokeApiTokenBusOutput = Effect.Effect<
  void,
  ApiTokenNotFound | PersistenceUnavailable,
  Database.Database | UnitOfWork
>;

// Fire-and-forget last-used stamp; swallows its own errors (no uow).
type TouchApiTokenBusOutput = Effect.Effect<void, never, Database.Database>;

// Device flow (ADR-0024). Start/approve run in a uow over the grant repo;
// poll additionally mints (ApiToken repo), all in one transaction.
type StartDeviceGrantBusOutput = Effect.Effect<
  StartDeviceGrantResult,
  PersistenceUnavailable,
  Database.Database | UnitOfWork
>;

type ApproveDeviceGrantBusOutput = Effect.Effect<
  void,
  DeviceGrantNotFound | DeviceGrantExpired | PersistenceUnavailable,
  Database.Database | UnitOfWork
>;

type PollDeviceGrantBusOutput = Effect.Effect<
  MintApiTokenResult,
  DeviceGrantNotFound | DeviceGrantExpired | DeviceGrantPending | PersistenceUnavailable,
  Database.Database | UnitOfWork
>;

declare module "@/platform/ddd/ports/command-bus.js" {
  // eslint-disable-next-line @typescript-eslint/consistent-type-definitions -- declaration merging requires `interface`
  interface CommandRegistry {
    SignInCommand: {
      readonly command: SignInCommand;
      readonly output: SignInBusOutput;
    };
    TouchSessionCommand: {
      readonly command: TouchSessionCommand;
      readonly output: TouchSessionBusOutput;
    };
    RevokeSessionCommand: {
      readonly command: RevokeSessionCommand;
      readonly output: RevokeSessionBusOutput;
    };
    MintApiTokenCommand: {
      readonly command: MintApiTokenCommand;
      readonly output: MintApiTokenBusOutput;
    };
    RevokeApiTokenCommand: {
      readonly command: RevokeApiTokenCommand;
      readonly output: RevokeApiTokenBusOutput;
    };
    TouchApiTokenCommand: {
      readonly command: TouchApiTokenCommand;
      readonly output: TouchApiTokenBusOutput;
    };
    StartDeviceGrantCommand: {
      readonly command: StartDeviceGrantCommand;
      readonly output: StartDeviceGrantBusOutput;
    };
    ApproveDeviceGrantCommand: {
      readonly command: ApproveDeviceGrantCommand;
      readonly output: ApproveDeviceGrantBusOutput;
    };
    PollDeviceGrantCommand: {
      readonly command: PollDeviceGrantCommand;
      readonly output: PollDeviceGrantBusOutput;
    };
  }
}

export const authCommandHandlers = commandHandlers({
  SignInCommand: {
    handle: (cmd): SignInBusOutput =>
      signIn(cmd).pipe(
        Effect.provide(AuthIdentityRepositoryLive),
        Effect.provide(SessionRepositoryLive),
      ),
    spanAttributes: signInCommandSpanAttributes,
  },
  TouchSessionCommand: {
    handle: (cmd): TouchSessionBusOutput =>
      touchSession(cmd).pipe(Effect.provide(SessionRepositoryLive)),
    spanAttributes: touchSessionCommandSpanAttributes,
  },
  RevokeSessionCommand: {
    handle: (cmd): RevokeSessionBusOutput =>
      revokeSession(cmd).pipe(Effect.provide(SessionRepositoryLive)),
    spanAttributes: revokeSessionCommandSpanAttributes,
  },
  MintApiTokenCommand: {
    handle: (cmd): MintApiTokenBusOutput =>
      mintApiToken(cmd).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: mintApiTokenCommandSpanAttributes,
  },
  RevokeApiTokenCommand: {
    handle: (cmd): RevokeApiTokenBusOutput =>
      revokeApiToken(cmd).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: revokeApiTokenCommandSpanAttributes,
  },
  TouchApiTokenCommand: {
    handle: (cmd): TouchApiTokenBusOutput =>
      touchApiToken(cmd).pipe(Effect.provide(ApiTokenRepositoryLive)),
    spanAttributes: touchApiTokenCommandSpanAttributes,
  },
  StartDeviceGrantCommand: {
    handle: (cmd): StartDeviceGrantBusOutput =>
      startDeviceGrant(cmd).pipe(Effect.provide(DeviceGrantRepositoryLive)),
    spanAttributes: startDeviceGrantCommandSpanAttributes,
  },
  ApproveDeviceGrantCommand: {
    handle: (cmd): ApproveDeviceGrantBusOutput =>
      approveDeviceGrant(cmd).pipe(Effect.provide(DeviceGrantRepositoryLive)),
    spanAttributes: approveDeviceGrantCommandSpanAttributes,
  },
  PollDeviceGrantCommand: {
    handle: (cmd): PollDeviceGrantBusOutput =>
      pollDeviceGrant(cmd).pipe(
        Effect.provide(DeviceGrantRepositoryLive),
        Effect.provide(ApiTokenRepositoryLive),
      ),
    spanAttributes: pollDeviceGrantCommandSpanAttributes,
  },
});
