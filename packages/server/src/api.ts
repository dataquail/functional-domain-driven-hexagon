import * as HttpApi from "@effect/platform/HttpApi";
import { DomainApi } from "@org/domain/DomainApi";

export const Api = HttpApi.make("api").addHttpApi(DomainApi);
