import * as HttpApi from "effect/http-api/HttpApi";

import * as AuthContract from "./api/AuthContract";
import * as BillingContract from "./api/BillingContract";
import * as OrganizationContract from "./api/OrganizationContract";
import * as TodosContract from "./api/TodosContract";
import * as UserContract from "./api/UserContract";

export class DomainApi extends HttpApi.make("domain")
  .add(TodosContract.Group)
  .add(UserContract.Group)
  .add(OrganizationContract.Group)
  .add(OrganizationContract.AdminGroup)
  .add(OrganizationContract.InvitationGroup)
  .add(AuthContract.PublicGroup)
  .add(AuthContract.PrivateGroup)
  .add(AuthContract.TokensGroup)
  .add(AuthContract.DeviceApprovalGroup)
  .add(BillingContract.PrivateGroup)
  .add(BillingContract.PublicGroup) {}
