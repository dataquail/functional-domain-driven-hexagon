import * as Schema from "effect/Schema";

import { type SpanAttributesExtractor } from "@/platform/ddd/contracts/span-attributable.js";

// Address fields are optional so the same command serves both the
// address-collecting create-user endpoint and JIT provisioning (which only
// has an email). The three move together — supply all or none.
export const CreateUserCommand = Schema.TaggedStruct("CreateUserCommand", {
  email: Schema.String,
  country: Schema.optional(Schema.String),
  street: Schema.optional(Schema.String),
  postalCode: Schema.optional(Schema.String),
});
export type CreateUserCommand = typeof CreateUserCommand.Type;

// Every input field is PII (email, postal address); none are span-safe.
// The generated user id is annotated from inside the handler instead.
export const createUserCommandSpanAttributes: SpanAttributesExtractor<
  CreateUserCommand
> = () => ({});
