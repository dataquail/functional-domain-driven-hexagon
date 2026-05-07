import * as HttpApi from "@effect/platform/HttpApi";
import * as AuthContract from "./api/AuthContract.js";
import * as TodosContract from "./api/TodosContract.js";
import * as UserContract from "./api/UserContract.js";

export class DomainApi extends HttpApi.make("domain")
  .add(TodosContract.Group)
  .add(UserContract.Group)
  .add(AuthContract.PublicGroup)
  .add(AuthContract.PrivateGroup) {}
