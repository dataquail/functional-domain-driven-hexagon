import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

import { Api } from "@/api.js";
import { createEndpoint } from "@/modules/user/interface/http/create.endpoint.js";
import { deleteEndpoint } from "@/modules/user/interface/http/delete.endpoint.js";
import { findEndpoint } from "@/modules/user/interface/http/find.endpoint.js";

export const UserLive = HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("find", findEndpoint)
    .handle("create", createEndpoint)
    .handle("delete", deleteEndpoint),
);
