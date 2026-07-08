import * as crypto from "node:crypto";

import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";

import {
  type CreateOrganizationCommand,
  type CreateOrganizationOutput,
} from "@/modules/organization/commands/create-organization.command.js";
import { MembershipRootOps } from "@/modules/organization/domain/membership.root.js";
import { SuperAdminCannotOwnOrganization } from "@/modules/organization/domain/organization.errors.js";
import { OrganizationRootOps } from "@/modules/organization/domain/organization.root.js";
import { OrganizationRolesRootOps } from "@/modules/organization/domain/organization-roles.root.js";
import { MembershipRepository } from "@/modules/organization/domain/ports/repositories/membership.repository.js";
import { OrganizationRepository } from "@/modules/organization/domain/ports/repositories/organization.repository.js";
import { OrganizationRolesRepository } from "@/modules/organization/domain/ports/repositories/organization-roles.repository.js";
import { DomainEventBus } from "@/platform/ddd/ports/domain-event-bus.js";
import { RoleService } from "@/platform/ddd/ports/role-service.js";
import { withUnitOfWork } from "@/platform/ddd/ports/with-unit-of-work.js";
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
    // Model invariant: super-admins are a separate user type — they
    // don't own or join organizations. The check sits at the use-case
    // level (not at HTTP authz) because the rule is a fact about the
    // role model, not a per-resource permission decision.
    const roles = yield* RoleService;
    const perms = yield* roles.findPlatformPermissions(cmd.actorUserId);
    if (perms.roles.includes("super_admin")) {
      return yield* Effect.fail(new SuperAdminCannotOwnOrganization({ userId: cmd.actorUserId }));
    }

    const orgRepo = yield* OrganizationRepository;
    const memberRepo = yield* MembershipRepository;
    const orgRolesRepo = yield* OrganizationRolesRepository;
    const bus = yield* DomainEventBus;
    const now = yield* DateTime.now;
    const id = OrganizationId.make(crypto.randomUUID());
    const { events: orgEvents, organization } = OrganizationRootOps.create({
      id,
      name: cmd.name,
      now,
    });
    const { events: memberEvents, membership } = MembershipRootOps.create({
      userId: cmd.actorUserId,
      organizationId: id,
      now,
    });
    // `grantRole` returns `Either<Result, AlreadyHasOrganizationRole>`.
    // We just constructed `empty(...)` so the only way this could be a
    // Left is a domain-model defect — die explicitly so the typed
    // error channel stays clean for the bus signature.
    const seedRoles = OrganizationRolesRootOps.empty(cmd.actorUserId, id);
    const grantEither = OrganizationRolesRootOps.grantRole(seedRoles, "admin", cmd.actorUserId);
    if (Result.isFailure(grantEither)) {
      return yield* Effect.die(grantEither.failure);
    }
    const grantResult = grantEither.success;

    yield* orgRepo.insertOne(organization);
    yield* memberRepo.insertOne(membership);
    yield* orgRolesRepo.upsertOne(grantResult.organizationRoles);
    yield* bus.dispatch([...orgEvents, ...memberEvents, ...grantResult.events]);
    return id;
  }).pipe(withUnitOfWork);
