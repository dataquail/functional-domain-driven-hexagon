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

type SignInBusOutput = Effect.Effect<
  SignInResult,
  CustomHttpApiError.Unauthorized | PersistenceUnavailable,
  Database.Database
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
