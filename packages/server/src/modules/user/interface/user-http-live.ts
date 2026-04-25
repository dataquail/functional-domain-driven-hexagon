import { Api } from "@/api.js";
import { changeRoleEndpoint } from "@/modules/user/interface/change-role.endpoint.js";
import { createEndpoint } from "@/modules/user/interface/create.endpoint.js";
import { deleteEndpoint } from "@/modules/user/interface/delete.endpoint.js";
import { findEndpoint } from "@/modules/user/interface/find.endpoint.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

export const UserHttpLive = HttpApiBuilder.group(Api, "user", (handlers) =>
  handlers
    .handle("find", findEndpoint)
    .handle("create", createEndpoint)
    .handle("delete", deleteEndpoint)
    .handle("changeRole", changeRoleEndpoint),
);
