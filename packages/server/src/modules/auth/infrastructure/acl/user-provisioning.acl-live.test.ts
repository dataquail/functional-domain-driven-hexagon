import { describe, it } from "@effect/vitest";
import { Database } from "@org/database/index";
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
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import { UserId } from "@/platform/ids/user-id.js";

// `UserProvisioningLive` is a thin translation over the CommandBus: it turns
// "provision a user with this email" into the user module's own
// `CreateUserCommand` and maps that module's `UserAlreadyExists` into the
// conflict this module owns. We stub the bus and the three singletons the
// Live captures to re-provide to the dispatched effect.
const provisionedId = UserId.make("99999999-9999-9999-9999-999999999999");

const stubCommandBus = (onCreateUser: (email: string) => Effect.Effect<UserId, { _tag: string }>) =>
  Layer.succeed(
    CommandBus,
    CommandBus.of({
      execute: ((command: { _tag: string; email: string }) =>
        command._tag === "CreateUserCommand"
          ? onCreateUser(command.email)
          : Effect.die(`unexpected command ${command._tag}`)) as never,
    }),
  );

// The Live re-provides these to the bus-dispatched effect; the stub bus never
// touches them, so opaque placeholders are fine.
const stubDatabase = Layer.succeed(Database.Database, {} as Database.Database["Service"]);
const stubEventBus = Layer.succeed(DomainEventBus, {} as DomainEventBus["Service"]);
const stubUnitOfWork = Layer.succeed(UnitOfWork, {} as UnitOfWork["Service"]);

const testLayer = (onCreateUser: (email: string) => Effect.Effect<UserId, { _tag: string }>) =>
  UserProvisioningLive.pipe(
    Layer.provide(stubCommandBus(onCreateUser)),
    Layer.provide(Layer.mergeAll(stubDatabase, stubEventBus, stubUnitOfWork)),
  );

describe("UserProvisioningLive", () => {
  it.effect("dispatches CreateUserCommand for the email and returns the new user id", () => {
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
    }).pipe(Effect.provide(testLayer(() => Effect.fail({ _tag: "UserAlreadyExists" })))),
  );
});
