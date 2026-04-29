import * as HttpApiEndpoint from "@effect/platform/HttpApiEndpoint";
import * as HttpApiGroup from "@effect/platform/HttpApiGroup";
import * as Schema from "effect/Schema";
import { UserAuthMiddleware } from "../Policy.js";
import * as TodosContract from "./TodosContract.js";

// Health-check ping. Hit POST /sse/notify on a logged-in connection to verify
// the pipe is open end-to-end. Not used by product code.
export class TestEvent extends Schema.TaggedClass<TestEvent>("TestEvent")("TestEvent", {
  message: Schema.String,
}) {}

// Aggregator union the client decodes against. Each module owns its event
// schemas (TodosContract.SseEvents, …); add new module unions here.
export const Events = Schema.Union(
  TestEvent,
  TodosContract.SseEvents.UpsertedTodo,
  TodosContract.SseEvents.DeletedTodo,
);
export type Events = typeof Events.Type;

export class Group extends HttpApiGroup.make("sse")
  .middleware(UserAuthMiddleware)
  .add(HttpApiEndpoint.get("connect", "/connect").addSuccess(Schema.Unknown))
  .add(HttpApiEndpoint.post("notify", "/notify").addSuccess(Schema.Void))
  .prefix("/sse") {}
