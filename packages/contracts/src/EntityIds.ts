import * as Schema from "effect/Schema";

export const UserId = Schema.String.pipe(Schema.brand("UserId"));
export type UserId = typeof UserId.Type;

export const TodoId = Schema.String.pipe(Schema.brand("TodoId"));
export type TodoId = typeof TodoId.Type;

export const OrganizationId = Schema.String.pipe(Schema.brand("OrganizationId"));
export type OrganizationId = typeof OrganizationId.Type;

export const InvitationId = Schema.String.pipe(Schema.brand("InvitationId"));
export type InvitationId = typeof InvitationId.Type;

export const SubscriptionId = Schema.String.pipe(Schema.brand("SubscriptionId"));
export type SubscriptionId = typeof SubscriptionId.Type;
