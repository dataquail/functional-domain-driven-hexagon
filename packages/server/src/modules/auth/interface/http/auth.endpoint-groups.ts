import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";
import * as Layer from "effect/Layer";

import { Api } from "@/globals/infrastructure/framework/http/api";

import { CliAuthLive } from "../cli/auth.endpoint-groups";
import { callbackEndpoint } from "./callback.endpoint";
import { createTokenEndpoint } from "./create-token.endpoint";
import { deviceApproveEndpoint } from "./device-approve.endpoint";
import { listTokensEndpoint } from "./list-tokens.endpoint";
import { loginEndpoint } from "./login.endpoint";
import { logoutEndpoint } from "./logout.endpoint";
import { meEndpoint } from "./me.endpoint";
import { revokeTokenEndpoint } from "./revoke-token.endpoint";

const AuthPublicLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handleRaw("login", loginEndpoint)
    .handleRaw("callback", callbackEndpoint)
    .handleRaw("logout", logoutEndpoint),
);

const AuthPrivateLive = HttpApiBuilder.group(Api, "authSession", (handlers) =>
  handlers.handle("me", meEndpoint),
);

// GUI-managed personal access tokens (ADR-0005). Mint/list/revoke are a
// human-in-the-browser concern, so they live on the GUI surface alongside
// `me`, all behind `UserAuthMiddleware`.
const AuthTokensLive = HttpApiBuilder.group(Api, "authTokens", (handlers) =>
  handlers
    .handle("create", createTokenEndpoint)
    .handle("list", listTokensEndpoint)
    .handle("revoke", revokeTokenEndpoint),
);

// Browser-side device-grant approval (GUI surface).
const AuthDeviceLive = HttpApiBuilder.group(Api, "authDevice", (handlers) =>
  handlers.handle("approve", deviceApproveEndpoint),
);

export const AuthLive = Layer.mergeAll(
  AuthPublicLive,
  AuthPrivateLive,
  AuthTokensLive,
  AuthDeviceLive,
  // CLI-facing device start/poll (the `cliAuth` group on CliApi). Registered
  // here so AuthModuleLive wires the whole auth surface in one place.
  CliAuthLive,
);
