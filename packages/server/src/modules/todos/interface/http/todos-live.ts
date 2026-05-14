import { Api } from "@/api.js";
import { createEndpoint } from "@/modules/todos/interface/http/create.endpoint.js";
import { deleteEndpoint } from "@/modules/todos/interface/http/delete.endpoint.js";
import { getEndpoint } from "@/modules/todos/interface/http/get.endpoint.js";
import { updateEndpoint } from "@/modules/todos/interface/http/update.endpoint.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

export const TodosLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  handlers
    .handle("get", getEndpoint)
    .handle("create", createEndpoint)
    .handle("update", updateEndpoint)
    .handle("delete", deleteEndpoint),
);
