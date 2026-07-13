import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";
import { type UserId } from "@/platform/ids/user-id.js";

import { type UserRoot } from "./user.root.js";

// Translatable specs (carry a Criteria → usable as repository filters and as
// in-memory guards). The field-name strings live here and in the mapper's
// column map; `Spec.eq` types them against UserRoot so a typo is a compile
// error.
const withId = (id: UserId): Specification<UserRoot> => Spec.eq<UserRoot, "id">("id", id);

const withEmail = (email: string): Specification<UserRoot> =>
  Spec.eq<UserRoot, "email">("email", email);

export const UserSpecifications = { withId, withEmail } as const;
