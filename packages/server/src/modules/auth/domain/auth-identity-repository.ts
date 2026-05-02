import { type UserId } from "@/platform/ids/user-id.js";
import * as Context from "effect/Context";
import type * as Effect from "effect/Effect";
import { type AuthIdentityNotFound } from "./session-errors.js";

export type AuthIdentity = {
  readonly subject: string;
  readonly userId: UserId;
  readonly provider: string;
};

export type AuthIdentityRepositoryShape = {
  readonly findBySubject: (subject: string) => Effect.Effect<AuthIdentity, AuthIdentityNotFound>;
};

export class AuthIdentityRepository extends Context.Tag("AuthIdentityRepository")<
  AuthIdentityRepository,
  AuthIdentityRepositoryShape
>() {}
