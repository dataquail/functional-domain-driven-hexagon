import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { Api } from "@/globals/infrastructure/framework/http/api.ts";
import { createEndpoint } from "@/modules/todos/interface/http/create.endpoint.ts";
import { deleteEndpoint } from "@/modules/todos/interface/http/delete.endpoint.ts";
import { getEndpoint } from "@/modules/todos/interface/http/get.endpoint.ts";
import { updateEndpoint } from "@/modules/todos/interface/http/update.endpoint.ts";

export const TodosLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  handlers
    .handle("get", getEndpoint)
    .handle("create", createEndpoint)
    .handle("update", updateEndpoint)
    .handle("delete", deleteEndpoint),
);
