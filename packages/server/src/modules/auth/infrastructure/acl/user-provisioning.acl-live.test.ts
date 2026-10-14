import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import { assertInstanceOf, assertNone, assertSome } from "@effect/vitest/utils";
import { Command, Query } from "@effect-server-utils/cqrs";
import { type PersistenceUnavailable } from "@effect-server-utils/unit-of-work";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import { UserId } from "@/globals/application/ddd/ids/user-id.js";
import {
  userAccessCommands,
  userAccessErrors,
  userSignInAccessQueries,
} from "@/modules/auth/auth.imports.js";
import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { UserProvisioningLive } from "@/modules/auth/infrastructure/acl/user-provisioning.acl-live.js";

// `UserProvisioningLive` is a thin translation over the user module's own dispatch
// surface: it turns "provision a user with this email" into that module's
// `CreateUserCommand` and maps that module's `UserAlreadyExists` into the conflict
// this module owns.
const provisionedId = UserId.make("99999999-9999-9999-9999-999999999999");

type OnCreateUser = (
  email: string,
) => Effect.Effect<
  UserId,
  InstanceType<typeof userAccessErrors.UserAlreadyExists> | PersistenceUnavailable
>;

const stubUserCommands = (onCreateUser: OnCreateUser) =>
  Command.handlersOf(userAccessCommands, {
    CreateUserCommand: ({ email }) => onCreateUser(email),
    FindUsersByIdsQuery: () => Effect.die("unexpected FindUsersByIdsQuery"),
  });

const registeredUsers = new Map([["member@example.com", provisionedId]]);

const stubUserQueries = Query.handlersOf(userSignInAccessQueries, {
  FindUserIdByEmailQuery: ({ email }) =>
    Effect.succeed(Option.getOrNull(Option.fromUndefinedOr(registeredUsers.get(email)))),
});

const testLayer = (onCreateUser: OnCreateUser) =>
  UserProvisioningLive.pipe(
    Layer.provide(Layer.mergeAll(stubUserCommands(onCreateUser), stubUserQueries)),
  );

describe("UserProvisioningLive", () => {
  it.effect("dispatches CreateUserPayload for the email and returns the new user id", () => {
    const dispatched: Array<string> = [];

    return Effect.gen(function* () {
      const provisioning = yield* UserProvisioning;
      const userId = yield* provisioning.provision("new@example.com");
      deepStrictEqual(userId, provisionedId);
      deepStrictEqual(dispatched, ["new@example.com"]);
    }).pipe(
      Effect.provide(
        testLayer((email) => {
          dispatched.push(email);

          return Effect.succeed(provisionedId);
        }),
      ),
    );
  });

  it.effect("maps the user module's UserAlreadyExists to UserProvisioningConflict", () =>
    Effect.gen(function* () {
      const provisioning = yield* UserProvisioning;
      const error = yield* Effect.flip(provisioning.provision("taken@example.com"));
      assertInstanceOf(error, UserProvisioningConflict);
      deepStrictEqual(error.email, "taken@example.com");
    }).pipe(
      Effect.provide(
        testLayer((email) => Effect.fail(new userAccessErrors.UserAlreadyExists({ email }))),
      ),
    ),
  );

  it.effect("asks the user module for the user registered under an email", () =>
    Effect.gen(function* () {
      const provisioning = yield* UserProvisioning;
      assertSome(yield* provisioning.findByEmail("member@example.com"), provisionedId);
      assertNone(yield* provisioning.findByEmail("nobody@example.com"));
    }).pipe(Effect.provide(testLayer(() => Effect.die("unexpected CreateUserCommand")))),
  );
});
