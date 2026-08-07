import { describe, it } from "@effect/vitest";
import { type PersistenceUnavailable } from "@org/cqrs";
import { deepStrictEqual } from "assert";
import * as Cause from "effect/Cause";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";

import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { UserProvisioningLive } from "@/modules/auth/infrastructure/acl/user-provisioning.acl-live.js";
import { UserAlreadyExists, UserCommands } from "@/modules/user/index.js";
import { UserId } from "@/platform/ids/user-id.js";

// `UserProvisioningLive` is a thin translation over the user module's own dispatch
// surface: it turns "provision a user with this email" into that module's
// `CreateUserCommand` and maps that module's `UserAlreadyExists` into the conflict
// this module owns.
const provisionedId = UserId.make("99999999-9999-9999-9999-999999999999");

type OnCreateUser = (
  email: string,
) => Effect.Effect<UserId, UserAlreadyExists | PersistenceUnavailable>;

const stubUserCommands = (onCreateUser: OnCreateUser) =>
  Layer.succeed(
    UserCommands,
    UserCommands.of({
      CreateUserCommand: ({ email }) => onCreateUser(email),
      DeleteUserCommand: () => Effect.die("unexpected DeleteUserCommand"),
    }),
  );

const testLayer = (onCreateUser: OnCreateUser) =>
  UserProvisioningLive.pipe(Layer.provide(stubUserCommands(onCreateUser)));

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
      const exit = yield* Effect.exit(provisioning.provision("taken@example.com"));
      deepStrictEqual(Exit.isFailure(exit), true);
      if (Exit.isFailure(exit)) {
        const error = Cause.hasFails(exit.cause)
          ? Cause.findErrorOption(exit.cause).pipe(Option.getOrThrow)
          : null;
        deepStrictEqual(error instanceof UserProvisioningConflict, true);
        deepStrictEqual((error as UserProvisioningConflict).email, "taken@example.com");
      }
    }).pipe(Effect.provide(testLayer((email) => Effect.fail(new UserAlreadyExists({ email }))))),
  );
});
