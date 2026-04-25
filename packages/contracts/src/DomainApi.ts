import * as HttpApi from "@effect/platform/HttpApi";
import * as SseContract from "./api/SseContract.js";
import * as TodosContract from "./api/TodosContract.js";

export class DomainApi extends HttpApi.make("domain")
  .add(TodosContract.Group)
  .add(SseContract.Group) {}
