import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { OrganizationRolesRepository } from "@/modules/organization/domain/organization-roles/organization-roles.repository.js";
import { OrganizationRolesSpecifications } from "@/modules/organization/domain/organization-roles/organization-roles.specification.js";
import { OrganizationRolesRepositoryLive } from "@/modules/organization/infrastructure/repositories/organization-roles.repository-live.js";
import { Spec } from "@/platform/ddd/contracts/specification.js";
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
        repo
          .findOne(
            Spec.and(
              OrganizationRolesSpecifications.forUser(userId),
              OrganizationRolesSpecifications.forOrganization(organizationId),
            ),
          )
          .pipe(
            // No rows → no roles (the empty-aggregate state); this service only
            // needs the role names, so it reads them off the aggregate or [].
            Effect.map((aggregate) => ({
              userId,
              organizationId,
              roles: (aggregate?.roles ?? [])
                .map((r) => r.role)
                .filter((r): r is OrganizationRoleName => narrow(r)),
            })),
            Effect.withSpan("OrganizationRoleService.findOrganizationPermissions"),
          ),
    });
  }),
).pipe(Layer.provide(OrganizationRolesRepositoryLive));
