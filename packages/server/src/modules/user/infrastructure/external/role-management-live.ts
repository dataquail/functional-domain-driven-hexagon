import { Database } from "@org/database/index";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { GrantRoleCommand, RevokeRoleCommand } from "@/modules/role/index.js";
import {
  RoleManagement,
  type RoleManagementShape,
  SelfPromotionForbidden,
} from "@/modules/user/domain/ports/external/role-management.js";
import { CommandBus } from "@/platform/ddd/ports/command-bus.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/ports/unit-of-work.js";

// Outbound adapter (ADR-0023): the one place in the user module allowed
// to import the role module's barrel. It constructs the role module's
// commands, dispatches them on the bus, and maps role-module errors back
// into the user-owned errors the `RoleManagement` port declares.
//
// `bus.execute` carries the handler's requirements (`DomainEventBus`,
// `UnitOfWork`, `Database`) in `R` — `makeCommandBus` does not discharge
// them. The port lives in `domain/`, where `domain-isolation` forbids
// importing those service Tags, so the port cannot carry them. The
// adapter therefore discharges them here, leaving the port methods
// `R = never`. The three services are satisfied at the composition root.
export const RoleManagementLive = Layer.effect(
  RoleManagement,
  Effect.gen(function* () {
    const bus = yield* CommandBus;
    const eventBus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const db = yield* Database.Database;

    const dischargeBusDeps = <A, E>(
      effect: Effect.Effect<A, E, DomainEventBus | UnitOfWork | Database.Database>,
    ): Effect.Effect<A, E> =>
      effect.pipe(
        Effect.provideService(DomainEventBus, eventBus),
        Effect.provideService(UnitOfWork, uow),
        Effect.provideService(Database.Database, db),
      );

    const grantSuperAdmin: RoleManagementShape["grantSuperAdmin"] = ({ actorUserId, userId }) =>
      dischargeBusDeps(
        bus.execute(GrantRoleCommand.make({ userId, role: "super_admin", actorUserId })),
      ).pipe(
        // Idempotent: already holding the role is the desired state.
        Effect.catchTag("AlreadyHasRole", () => Effect.void),
        // Translate the role module's invariant into the user-owned error.
        Effect.catchTag("CannotPromoteSelf", () =>
          Effect.fail(new SelfPromotionForbidden({ userId })),
        ),
        // `PersistenceUnavailable` flows through unchanged — it is part of
        // the port's declared failure channel.
      );

    const revokeSuperAdmin: RoleManagementShape["revokeSuperAdmin"] = ({ userId }) =>
      dischargeBusDeps(bus.execute(RevokeRoleCommand.make({ userId, role: "super_admin" }))).pipe(
        // Idempotent: revoking a role never held is a no-op success.
        Effect.catchTag("DoesNotHaveRole", () => Effect.void),
      );

    return RoleManagement.of({ grantSuperAdmin, revokeSuperAdmin });
  }),
);
