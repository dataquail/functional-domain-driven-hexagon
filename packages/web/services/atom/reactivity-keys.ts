// The invalidation vocabulary, in one place.
//
// A mutation names the keys it dirties and a query names the keys it depends
// on; the `Reactivity` service refreshes the intersection. Declaring both sides
// against this table is what stops a mutation and a query silently disagreeing
// about a key's spelling -- the failure that key-string typos used to produce
// was a stale screen with no error anywhere.

export const ReactivityKeys = {
  users: ["users"],
  todos: ["todos"],
  organizations: ["organizations"],
  adminOrganizations: ["admin-organizations"],
  organizationMembers: ["organization-members"],
  organizationInvitations: ["organization-invitations"],
  billing: ["billing"],
  devices: ["devices"],
} as const satisfies Record<string, ReadonlyArray<string>>;
