import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { CreateUserCommand } from "@/modules/user/commands/create-user-command.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";
import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/platform/ddd/ports/user-provisioning.js";

// Live for the platform `UserProvisioning` ACL. Provisions an ordinary
// (non-admin) user by firing the user module's own `CreateUserCommand`
// through the command bus and returning the new `UserId`. It composes the
// command rather than opening its own unit of work, so when called inside a
// caller's `uow.run` (e.g. `auth` JIT sign-in) the create joins that
// transaction — `UnitOfWorkLive.run` is re-entrant and the repository's
// `makeQuery` resolves the ambient `TransactionContext` (ADR-0007).
//
// `CreateUserCommand`'s bus output leaves `Database | DomainEventBus |
// UnitOfWork` as residual R; we capture those singletons in the layer and
// provide them inline so the `UserProvisioning` Tag is R = never for
// consumers (same shape as `MembershipServiceLive`/`RoleServiceLive`). The
// user module's `UserAlreadyExists` is mapped to the platform-tier
// `UserProvisioningConflict` so consumers don't depend on user-module errors.
export const UserProvisioningLive = Layer.effect(
  UserProvisioning,
  Effect.gen(function* () {
    const commandBus = yield* CommandBus;
    const db = yield* Database.Database;
    const eventBus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;

    return UserProvisioning.of({
      provision: (email) =>
        commandBus.execute(CreateUserCommand.make({ email })).pipe(
          Effect.provideService(Database.Database, db),
          Effect.provideService(DomainEventBus, eventBus),
          Effect.provideService(UnitOfWork, uow),
          Effect.catchTag("UserAlreadyExists", () =>
            Effect.fail(new UserProvisioningConflict({ email })),
          ),
          Effect.withSpan("UserProvisioning.provision"),
        ),
    });
  }),
);
