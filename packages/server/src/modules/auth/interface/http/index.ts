import * as Layer from "effect/Layer";
import * as HttpApiBuilder from "effect/unstable/httpapi/HttpApiBuilder";

import { Api } from "@/api.js";

import { CliAuthLive } from "../cli/index.js";
import { callbackEndpoint } from "./callback.endpoint.js";
import { createTokenEndpoint } from "./create-token.endpoint.js";
import { deviceApproveEndpoint } from "./device-approve.endpoint.js";
import { listTokensEndpoint } from "./list-tokens.endpoint.js";
import { loginEndpoint } from "./login.endpoint.js";
import { logoutEndpoint } from "./logout.endpoint.js";
import { meEndpoint } from "./me.endpoint.js";
import { revokeTokenEndpoint } from "./revoke-token.endpoint.js";

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
