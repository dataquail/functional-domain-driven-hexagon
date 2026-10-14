import * as Redacted from "effect/Redacted";

const TLS_MODES: ReadonlySet<string> = new Set(["require", "verify-ca", "verify-full"]);

// A hosted database (Neon) says so in its URL; the docker one says nothing.
export const requiresTls = (url: Redacted.Redacted): boolean =>
  TLS_MODES.has(new URL(Redacted.value(url)).searchParams.get("sslmode") ?? "");
