import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { createEndpoint } from "@/modules/user/interface/http/create.endpoint";
import { deleteEndpoint } from "@/modules/user/interface/http/delete.endpoint";
import { findEndpoint } from "@/modules/user/interface/http/find.endpoint";

export const UserLive = HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("find", findEndpoint)
    .handle("create", createEndpoint)
    .handle("delete", deleteEndpoint),
);
