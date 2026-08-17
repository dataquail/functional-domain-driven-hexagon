// This application's action vocabulary, declared to `@effect-server-utils/authz` in authz.ts.
// Policies are written per (resource, action) — the action is one of these four
// CRUD verbs and the check callback encapsulates the nuance (super-admin-only,
// owner-or-admin, member-with-grant, etc.). Resisting custom action names per
// resource keeps the matrix small and the call sites readable: every
// `Authz.hasPermissions(R, Actions.Update, id)` reads the same way. A business
// rule that discriminates within UPDATE is a domain invariant and lives in the
// command, not here.
//
// Nothing about the DSL requires CRUD — the library takes whatever union this
// declares. Widening the vocabulary is a one-line change here plus the
// registrations that use it.
//
// Scopedness is a property of the RESOURCE, never of the action. A resource
// registered in `ResourceResolverMap` requires an id on every action —
// including Create, so "create a todo in org X" gates on the org — and its
// checks receive the resolved resource. A resource absent from that map is
// unscoped: it takes no id and its checks see only the caller. A resource may
// register policies for any subset of the four.

export const Actions = {
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];
