import { Module } from "@org/module";

// The peer-facing surface, and the one place the two halves come apart.
//
// `OrganizationQueries` is resolved from the container by todos' and billing's
// ACL adapters — a real DI edge — but those adapters are consumed by their
// modules' POLICY layers, which the composition root wires through
// `PolicyRegistryLive` rather than through the module builder. So the builder
// never sees the edge and cannot check it: listing the Tag in `Module.exports`
// would be refused as an export no module consumed. Until policy contributions
// are part of a module's builder layer, that edge is governed by who may import
// this file and nothing more.
export const organizationExports = Module.exports();

export { OrganizationCreated } from "./domain/organization/organization.events.js";
export { OrganizationQueries } from "./organization.query-handlers.js";
