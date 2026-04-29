import { Api } from "@/api.js";
import { createEndpoint } from "@/modules/todos/interface/create.endpoint.js";
import { deleteEndpoint } from "@/modules/todos/interface/delete.endpoint.js";
import { getEndpoint } from "@/modules/todos/interface/get.endpoint.js";
import { updateEndpoint } from "@/modules/todos/interface/update.endpoint.js";
import * as HttpApiBuilder from "@effect/platform/HttpApiBuilder";

export const TodosHttpLive = HttpApiBuilder.group(Api, "todos", (handlers) =>
  handlers
    .handle("get", getEndpoint)
    .handle("create", createEndpoint)
    .handle("update", updateEndpoint)
    .handle("delete", deleteEndpoint),
);
