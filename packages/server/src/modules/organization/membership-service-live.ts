import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { MembershipRepository } from "@/modules/organization/domain/membership-repository.js";
import { MembershipRepositoryLive } from "@/modules/organization/infrastructure/membership-repository-live.js";
import { MembershipService } from "@/platform/ddd/membership-service.js";

// Wraps the org module's own `MembershipRepository` into the generalized
// `MembershipService` ACL. The Live provides `MembershipRepositoryLive`
// internally — Effect's Layer memoization shares one instance with the
// command-handler wraps that also reference it.
export const MembershipServiceLive = Layer.effect(
  MembershipService,
  Effect.gen(function* () {
    const repo = yield* MembershipRepository;
    return MembershipService.of({
      isMember: (userId, organizationId) =>
        repo.findByUserIdAndOrgId(userId, organizationId).pipe(
          Effect.map(() => true),
          Effect.catchTag("MembershipNotFound", () => Effect.succeed(false)),
        ),
    });
  }),
).pipe(Layer.provide(MembershipRepositoryLive));
