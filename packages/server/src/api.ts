import * as HttpApi from "@effect/platform/HttpApi";
import { DomainApi } from "@org/contracts/DomainApi";

export const Api = HttpApi.make("api").addHttpApi(DomainApi);
