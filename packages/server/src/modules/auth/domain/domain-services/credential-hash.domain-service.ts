import { createHash } from "node:crypto";

// Domain service (ADR-0023): the rule that auth credentials are stored and
// compared by their sha256 hash, never in plaintext. It has no aggregate
// home — it applies to API-token secrets, device-grant codes, AND an
// arbitrary incoming bearer at lookup time (the auth middleware), where
// there is no aggregate instance at all. Pure and dependency-free, so it is
// a plain free-function bag, not an injected service.
//
// sha256 hex, unsalted: the inputs are high-entropy random values, so there
// is no low-entropy space to brute-force even if the stored column leaks.
export const CredentialHash = {
  of: (raw: string): string => createHash("sha256").update(raw).digest("hex"),
} as const;
