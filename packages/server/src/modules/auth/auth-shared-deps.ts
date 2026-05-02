import { CookieCodec } from "@/platform/auth/cookie-codec.js";
import * as Layer from "effect/Layer";
import { AuthIdentityRepositoryLive } from "./infrastructure/auth-identity-repository-live.js";
import { SessionRepositoryLive } from "./infrastructure/session-repository-live.js";

// Shared by the auth module's HTTP handlers AND the platform auth middleware.
// Provided once at the API layer so both consumers see the same instances.
export const AuthSharedDepsLive = Layer.mergeAll(
  CookieCodec.Default,
  SessionRepositoryLive,
  AuthIdentityRepositoryLive,
);
