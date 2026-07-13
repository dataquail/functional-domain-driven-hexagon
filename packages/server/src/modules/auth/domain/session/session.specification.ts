import { Spec, type Specification } from "@/platform/ddd/contracts/specification.js";

import { type SessionId } from "./session.id.js";
import { type SessionRoot } from "./session.root.js";

// Translatable spec (carries a Criteria → usable as a repository filter and as
// an in-memory guard). The field-name string lives here and in the mapper's
// column map; `Spec.eq` types it against SessionRoot so a typo is a compile
// error.
const withId = (id: SessionId): Specification<SessionRoot> => Spec.eq<SessionRoot, "id">("id", id);

export const SessionSpecifications = { withId } as const;
