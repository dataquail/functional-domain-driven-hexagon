import * as HttpApiBuilder from "effect/http-api/HttpApiBuilder";

import { Api } from "@/globals/infrastructure/framework/http/api";
import { createEndpoint } from "@/modules/todos/interface/http/create.endpoint";
import { deleteEndpoint } from "@/modules/todos/interface/http/delete.endpoint";
import { getEndpoint } from "@/modules/todos/interface/http/get.endpoint";
import { updateEndpoint } from "@/modules/todos/interface/http/update.endpoint";

export const TodosLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  handlers
    .handle("get", getEndpoint)
    .handle("create", createEndpoint)
    .handle("update", updateEndpoint)
    .handle("delete", deleteEndpoint),
);
