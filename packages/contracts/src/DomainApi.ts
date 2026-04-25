import * as HttpApi from "@effect/platform/HttpApi";
import * as SseContract from "./api/SseContract.js";
import * as TodosContract from "./api/TodosContract.js";
import * as UserContract from "./api/UserContract.js";

export class DomainApi extends HttpApi.make("domain")
  .add(TodosContract.Group)
  .add(SseContract.Group)
  .add(UserContract.Group) {}
