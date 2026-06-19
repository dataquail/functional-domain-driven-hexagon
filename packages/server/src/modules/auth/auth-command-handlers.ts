import type * as CustomHttpApiError from "@org/contracts/CustomHttpApiError";
import { type Database } from "@org/database/index";
import * as Effect from "effect/Effect";

import { revokeSession } from "@/modules/auth/commands/revoke-session.js";
import {
  type RevokeSessionCommand,
  revokeSessionCommandSpanAttributes,
} from "@/modules/auth/commands/revoke-session-command.js";
import { signIn } from "@/modules/auth/commands/sign-in.js";
import {
  type SignInCommand,
  signInCommandSpanAttributes,
  type SignInResult,
} from "@/modules/auth/commands/sign-in-command.js";
import { touchSession } from "@/modules/auth/commands/touch-session.js";
import {
  type TouchSessionCommand,
  touchSessionCommandSpanAttributes,
} from "@/modules/auth/commands/touch-session-command.js";
import { AuthIdentityRepositoryLive } from "@/modules/auth/infrastructure/auth-identity-repository-live.js";
import { SessionRepositoryLive } from "@/modules/auth/infrastructure/session-repository-live.js";
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

declare module "@/platform/ddd/ports/command-bus.js" {
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
});
