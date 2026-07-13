import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import { type OrganizationId } from "@/platform/ids/organization-id.js";

import { type WalletRoot } from "./wallet.root.js";

// Translatable spec (carries a Criteria → usable as a repository filter and as
// an in-memory guard). The field-name string lives here and in the mapper's
// column map; `Spec.eq` types it against WalletRoot so a typo is a compile
// error.
const forOrganization = (organizationId: OrganizationId): Specification<WalletRoot> =>
  Spec.eq<WalletRoot, "organizationId">("organizationId", organizationId);

export const WalletSpecifications = { forOrganization } as const;
