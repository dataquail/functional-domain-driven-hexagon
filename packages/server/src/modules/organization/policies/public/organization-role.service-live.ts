import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import {
  type OrganizationRoleName,
  OrganizationRoleService,
} from "@/platform/ddd/ports/organization-role-service.js";

const KNOWN_ROLES = new Set<string>(["admin"]);
const narrow = (role: string): role is OrganizationRoleName => KNOWN_ROLES.has(role);

// Wraps the org module's own `OrganizationRolesRepository` into the
// generalized `OrganizationRoleService` ACL. Same shape as
// `MembershipServiceLive` — the repo is internally provided so
// consuming policies see only the platform-layer service Tag in R.
// Effect's Layer memoization shares one repo instance with the
// command-handler wraps that also reference it.
export const OrganizationRoleServiceLive = Layer.effect(
  OrganizationRoleService,
  Effect.gen(function* () {
    const repo = yield* OrganizationRolesRepository;
    return OrganizationRoleService.of({
      findOrganizationPermissions: (userId, organizationId) =>
        repo.findOneByUserIdAndOrgId(userId, organizationId).pipe(
          Effect.map((aggregate) => ({
            userId: aggregate.userId,
            organizationId: aggregate.organizationId,
            roles: aggregate.roles
              .map((r) => r.role)
              .filter((r): r is OrganizationRoleName => narrow(r)),
          })),
          Effect.withSpan("OrganizationRoleService.findOrganizationPermissions"),
        ),
    });
  }),
).pipe(Layer.provide(OrganizationRolesRepositoryLive));
