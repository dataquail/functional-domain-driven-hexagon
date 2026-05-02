import { Api } from "@/api.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";
import * as Layer from "effect/Layer";
import { callbackEndpoint } from "./callback.endpoint.js";
import { loginEndpoint } from "./login.endpoint.js";
import { logoutEndpoint } from "./logout.endpoint.js";
import { meEndpoint } from "./me.endpoint.js";

const AuthPublicHttpLive = HttpApiBuilder.group(Api, "auth", (handlers) =>
  handlers
    .handleRaw("login", loginEndpoint)
    .handleRaw("callback", callbackEndpoint)
    .handleRaw("logout", logoutEndpoint),
);

const AuthPrivateHttpLive = HttpApiBuilder.group(Api, "authSession", (handlers) =>
  handlers.handle("me", meEndpoint),
);

export const AuthHttpLive = Layer.mergeAll(AuthPublicHttpLive, AuthPrivateHttpLive);
