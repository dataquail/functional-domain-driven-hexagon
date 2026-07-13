import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import { type AuthIdentity } from "./auth-identity.repository.js";

// Translatable spec (carries a Criteria → usable as a repository filter and as
// an in-memory guard). The field-name string lives here and in the mapper's
// column map; `Spec.eq` types it against AuthIdentity so a typo is a compile
// error.
const bySubject = (subject: string): Specification<AuthIdentity> =>
  Spec.eq<AuthIdentity, "subject">("subject", subject);

export const AuthIdentitySpecifications = { bySubject } as const;
