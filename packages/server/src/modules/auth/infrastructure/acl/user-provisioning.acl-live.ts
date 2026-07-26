import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  UserProvisioning,
  UserProvisioningConflict,
} from "@/modules/auth/domain/ports/acl/user-provisioning.acl.js";
import { CreateUserCommand } from "@/modules/user/index.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// ADR-0022 outbound adapter. The one place in the auth module where the user
// module's barrel is imported — sign-in depends on `UserProvisioning` instead.
//
// `CreateUserCommand`'s bus output leaves `Database | DomainEventBus |
// UnitOfWork` as residual R; those singletons are captured at construction and
// re-provided to the dispatched effect so the port's method surface stays
// `R = never`.
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
