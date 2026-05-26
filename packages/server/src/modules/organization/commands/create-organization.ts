import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Either from "effect/Either";

import {
  type CreateOrganizationCommand,
  type CreateOrganizationOutput,
} from "@/modules/organization/commands/create-organization-command.js";
import * as Membership from "@/modules/organization/domain/membership.aggregate.js";
import * as Organization from "@/modules/organization/domain/organization.aggregate.js";
import * as OrganizationRoles from "@/modules/organization/domain/organization-roles.aggregate.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership-repository.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization-repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles-repository.js";
import { DomainEventBus } from "@/platform/ddd/domain-event-bus.js";
import { UnitOfWork } from "@/platform/ddd/unit-of-work.js";
import { OrganizationId } from "@/platform/ids/organization-id.js";

// Creating an org also creates the creator's Membership AND grants the
// creator the `admin` OrganizationRole in the same unit of work —
// orgs without their first member are degenerate, and an org with no
// admin would be unmanageable (per Phase 4, only Org Admins can
// invite/remove members). The only path to first-membership for any
// non-creator is an Invitation (which requires an existing org with
// an admin to issue it).
//
// The admin grant is system-issued (`issuedBy = actorUserId`) — the
// creator promotes themselves on org creation as a constitutive
// invariant of org creation. This bypasses the `CannotPromoteSelf`
// invariant on the explicit `GrantOrganizationRoleCommand` path
// because that invariant guards interactive self-elevation through the
// bus, not the system-level seed.
export const createOrganization = (cmd: CreateOrganizationCommand): CreateOrganizationOutput =>
  Effect.gen(function* () {
    const orgRepo = yield* OrganizationRepository;
    const memberRepo = yield* MembershipRepository;
    const orgRolesRepo = yield* OrganizationRolesRepository;
    const bus = yield* DomainEventBus;
    const uow = yield* UnitOfWork;
    const now = yield* DateTime.now;
    const id = OrganizationId.make(crypto.randomUUID());
    const { events: orgEvents, organization } = Organization.create({ id, name: cmd.name, now });
    const { events: memberEvents, membership } = Membership.create({
      userId: cmd.actorUserId,
      organizationId: id,
      now,
    });
    // `grantRole` returns `Either<Result, AlreadyHasOrganizationRole>`.
    // We just constructed `empty(...)` so the only way this could be a
    // Left is a domain-model defect — die explicitly so the typed
    // error channel stays clean for the bus signature.
    const seedRoles = OrganizationRoles.empty(cmd.actorUserId, id);
    const grantEither = OrganizationRoles.grantRole(seedRoles, "admin", cmd.actorUserId);
    if (Either.isLeft(grantEither)) {
      return yield* Effect.die(grantEither.left);
    }
    const grantResult = grantEither.right;

    yield* uow
      .run(
        Effect.gen(function* () {
          yield* orgRepo.insert(organization);
          yield* memberRepo.insert(membership);
          yield* orgRolesRepo.save(grantResult.organizationRoles);
          yield* bus.dispatch([...orgEvents, ...memberEvents, ...grantResult.events]);
        }),
      )
      .pipe(Effect.catchTag("DatabaseError", Effect.die));
    return id;
  });
