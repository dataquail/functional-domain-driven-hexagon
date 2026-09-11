import { Module } from "@org/module";

// Nothing. Organization reaches role and user through its own ACL ports; nothing
// reaches back. Its policy-queries are a cross-module contract, but a consumer
// gets at them through its own ACL adapter and the bus, never by resolving this
// module's dispatch surface.
export const organizationExports = Module.exports();
