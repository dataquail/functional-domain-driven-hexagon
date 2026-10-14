import { deepStrictEqual } from "node:assert";

import { describe, it } from "@effect/vitest";
import * as ConfigProvider from "effect/ConfigProvider";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { IssuerTransport } from "@/globals/infrastructure/runtime/issuer-transport.js";
import { OidcClient } from "@/modules/auth/infrastructure/clients/oidc.client.js";

const ISSUER = "http://identity.internal/api/auth";

const env = {
  DATABASE_URL: "postgres://localhost/app",
  IDENTITY_ISSUER: ISSUER,
  IDENTITY_CLIENT_ID: "app",
  IDENTITY_CLIENT_SECRET: "secret",
  SESSION_COOKIE_SECRET: "0".repeat(64),
  STRIPE_SECRET_KEY: "sk_test",
  STRIPE_WEBHOOK_SECRET: "whsec_test",
  STRIPE_PRICE_ID_DEFAULT: "price_test",
};

const discoveryDocument = {
  issuer: ISSUER,
  authorization_endpoint: `${ISSUER}/oauth2/authorize`,
  token_endpoint: `${ISSUER}/oauth2/token`,
  end_session_endpoint: `${ISSUER}/oauth2/end-session`,
  jwks_uri: `${ISSUER}/jwks`,
};

const recordingTransport = (requested: Array<string>) =>
  Layer.succeed(IssuerTransport, {
    fetch: async (url) => {
      requested.push(url);
      return Response.json(discoveryDocument);
    },
  });

const clientWith = (transport: Layer.Layer<never>) =>
  OidcClient.layer.pipe(
    Layer.provide(transport),
    Layer.provide(ConfigProvider.layer(ConfigProvider.fromUnknown(env))),
  );

describe("OidcClient", () => {
  it.effect("discovers the issuer through the transport it is given", () =>
    Effect.gen(function* () {
      const requested: Array<string> = [];
      const authorize = yield* Effect.flatMap(
        Effect.service(OidcClient),
        (client) => client.buildAuthorize,
      ).pipe(Effect.provide(clientWith(recordingTransport(requested))));

      deepStrictEqual(requested, [`${ISSUER}/.well-known/openid-configuration`]);
      deepStrictEqual(authorize.url.origin + authorize.url.pathname, `${ISSUER}/oauth2/authorize`);
    }),
  );
});
