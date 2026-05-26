// Platform-wide action vocabulary. Policies are written per (resource,
// action) — the action is one of these four CRUD verbs and the check
// callback encapsulates the nuance (super-admin-only, owner-or-admin,
// member-with-grant, etc.). Resisting custom action names per resource
// keeps the matrix small and the call sites readable: every
// `Authz.requiresOn(R, Actions.Update, id)` reads the same way.
//
// CREATE is flat (no resource id — there's no record yet). READ /
// UPDATE / DELETE are resource-scoped. A resource may register policies
// for any subset of the four.

export const Actions = {
  Create: "create",
  Read: "read",
  Update: "update",
  Delete: "delete",
} as const;

export type Action = (typeof Actions)[keyof typeof Actions];
export type FlatAction = typeof Actions.Create;
export type ResourceScopedAction = Exclude<Action, FlatAction>;
