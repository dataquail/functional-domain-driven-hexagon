import * as Effect from "effect/Effect";
import pg from "pg";

import { type ClientCredentials, makeIdentityAuth } from "../auth/identity-auth.js";
import type { IdentityEmail } from "../mail/identity-mailer.js";
import { identityTestDatabaseUrl, truncateIdentityTables } from "./identity-test-database.js";

export const IDENTITY_BASE_URL = "http://localhost:3002";
export const APP_URL = "http://localhost:3000";

export const makeIdentityTestHarness = () => {
  const database = new pg.Pool({ connectionString: identityTestDatabaseUrl(), max: 2 });
  const sent: Array<IdentityEmail> = [];
  const settings = (registerClientAs?: ClientCredentials) => ({
    baseUrl: IDENTITY_BASE_URL,
    secret: "identity-integration-tests-secret-0123456789abcdef",
    appUrl: APP_URL,
    database,
    mailer: {
      send: (email: IdentityEmail) =>
        Effect.sync(() => {
          sent.push(email);
        }),
    },
    ...(registerClientAs === undefined ? {} : { registerClientAs }),
  });
  return {
    sent,
    makeAuth: () => makeIdentityAuth(settings()),
    makeSeedingAuth: (client: ClientCredentials | undefined) =>
      makeIdentityAuth({ ...settings(client), sendVerificationOnSignUp: false }),
    reset: () => {
      sent.length = 0;
      return truncateIdentityTables(database);
    },
    close: () => database.end(),
  };
};

export const formPost = (path: string, fields: Record<string, string>): Request =>
  new Request(`${IDENTITY_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      origin: IDENTITY_BASE_URL,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams(fields),
  });

export const linkIn = (email: IdentityEmail | undefined): URL => {
  const match = /https?:\/\/\S+/.exec(email?.text ?? "");
  if (match === null) throw new Error("expected an email carrying a link");
  return new URL(match[0]);
};
