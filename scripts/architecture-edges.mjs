#!/usr/bin/env node
// The architecture policy's semantics, as edges with expected verdicts.
//
// `lint:rules` proves each RULE ID still fires somewhere; this proves the POLICY
// still says what it is supposed to say — per edge for the import rules, and
// per shape for the graph rules at the bottom. Every row was verified against the
// dependency-cruiser-era config before the manifest replaced it: the `allowed`
// rows are edges that config permitted, the `refused` rows are edges it
// forbade, and the `tightened` rows are edges it permitted that the manifest
// deliberately does not.
//
// A row that changes verdict is either a regression or a decision. Both should
// be visible in a diff.

import * as Result from "effect/Result";
import path from "node:path";
import {
  compileImportRules,
  evaluateGraph,
  evaluateImportEdge,
  lowerManifest,
  makeModuleResolverFake,
} from "oxlint-architecture-rules";

const repoRoot = process.cwd();

const manifest = (await import(path.join(repoRoot, "architecture.config.mjs"))).default;
const lowered = lowerManifest(manifest);
const compiled = compileImportRules(lowered.imports);
if (Result.isFailure(compiled)) throw compiled.failure;
const rules = compiled.success;

const M = "packages/server/src/modules";
const NPM = (name) => `node_modules/.pnpm/x/node_modules/${name}/index.js`;

// Edges the policy must REFUSE.
const REFUSED = [
  [
    "cross-module reach from a domain file",
    `${M}/alpha/domain/one/one.root.ts`,
    `${M}/beta/domain/two/two.root.ts`,
  ],
  [
    "a query handler reaching for root-ops",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "a repository Live reaching for entity-ops",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/domain/one/one.entity-ops.ts`,
  ],
  [
    "a policy reaching for a repository port",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "an endpoint reaching for an ACL port",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "an interface util reaching for a port",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a domain file reaching for the database package",
    `${M}/alpha/domain/one/one.root.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a domain file reaching for a non-effect npm package",
    `${M}/alpha/domain/one/one.root.ts`,
    "node_modules/.pnpm/lodash@4/node_modules/lodash/index.js",
  ],
  [
    "a domain file reaching into another subdomain",
    `${M}/alpha/domain/one/one.root.ts`,
    `${M}/alpha/domain/two/two.root.ts`,
  ],
  [
    "a domain file importing a test file",
    `${M}/alpha/domain/one/one.root.ts`,
    `${M}/alpha/domain/one/one.root-ops.test.ts`,
  ],
  [
    "a command reaching for @org/database",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a command reaching for @org/contracts",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  [
    "a command reaching into infrastructure",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
  ],
  [
    "a command reaching into its own queries",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/queries/find.handler.ts`,
  ],
  [
    "a command reaching for another module's barrel",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "a command naming a platform Live",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/server/src/platform/notifications/mailer-live.ts",
  ],
  [
    "a command reaching for a non-allowed npm package",
    `${M}/alpha/commands/do.handler.ts`,
    "node_modules/.pnpm/lodash@4/node_modules/lodash/index.js",
  ],
  [
    "a query loading an aggregate root",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a query reaching for a repository port",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a query reaching for a specification",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.specification.ts`,
  ],
  [
    "a query reaching into commands",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "infrastructure reaching into interface",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/interface/http/get.endpoint.ts`,
  ],
  [
    "a repository Live reaching for a command",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a repository Live reaching for a query",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/queries/find.handler.ts`,
  ],
  [
    "a repository Live reaching for the event bus",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    "packages/server/src/platform/ddd/event-bus.ts",
  ],
  [
    "an interface util reaching for a port",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "an interface util reaching for a command",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "an interface util reaching for a module barrel",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "an interface util reaching for infrastructure",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
  ],
  [
    "an event adapter loading a foreign root",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/beta/domain/two/two.root.ts`,
  ],
  [
    "an event adapter reaching for a repository",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a repository Live naming a foreign barrel",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "a repository Live reaching foreign internals",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    `${M}/beta/domain/two/two.root.ts`,
  ],
  [
    "an endpoint naming a foreign barrel",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "an event-handler naming a foreign barrel",
    `${M}/alpha/event-handlers/on-thing.handler.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "a policy loading an aggregate root",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a policy reaching for a specification",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/one/one.specification.ts`,
  ],
  [
    "a policy reaching into commands",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a saga reaching for a repository",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "a saga reaching for root-ops",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "a saga reaching for @org/database",
    `${M}/alpha/sagas/x.saga.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "contracts reaching the server",
    "packages/contracts/src/Policy.ts",
    "packages/server/src/platform/api.ts",
  ],
  [
    "contracts reaching the database",
    "packages/contracts/src/Policy.ts",
    "packages/database/src/index.ts",
  ],
  [
    "a View importing a spec file",
    "packages/web/features/orgs/x/x.view.tsx",
    "packages/web/features/orgs/x/x.view-model.test.ts",
  ],
  [
    "a component importing a spec file",
    "packages/components/primitives/button.tsx",
    "packages/components/primitives/button.test.tsx",
  ],
  [
    "a platform file importing a spec file",
    "packages/server/src/platform/http-endpoint.ts",
    "packages/server/src/platform/persistence/criteria-to-sql.test.ts",
  ],
  [
    "a command importing effect/unstable/rpc",
    "packages/server/src/modules/alpha/commands/do.handler.ts",
    "node_modules/.pnpm/effect@4/node_modules/effect/dist/unstable/rpc/RpcClient.js",
  ],
  [
    "the CLI importing @effect/sql-pg",
    "packages/cli/src/main.ts",
    "node_modules/.pnpm/x/node_modules/@effect/sql-pg/dist/index.js",
  ],
  [
    "a View reaching into services/",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/services/atom/api-atoms.shared.ts",
  ],
  [
    "a View importing effect/Effect",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "node_modules/.pnpm/effect@4/node_modules/effect/dist/Effect.js",
  ],
  [
    "a ViewModel importing a View",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
  ],
  [
    "a ViewModel importing react",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "node_modules/.pnpm/react@19/node_modules/react/index.js",
  ],
  [
    "a ViewModel importing atom-react",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "node_modules/.pnpm/x/node_modules/@effect/atom-react/dist/index.js",
  ],
  [
    "the Model importing a feature",
    "packages/web/services/atom/api-atoms.shared.ts",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
  ],
  [
    "a feature importing app/",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/app/layout.tsx",
  ],
  [
    "a cross-feature import",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/features/users/users-list/users-list.view-model.ts",
  ],
  [
    "web reaching a UI library directly",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "node_modules/.pnpm/x/node_modules/lucide-react/dist/index.js",
  ],
  [
    "web importing TanStack (refused by the web allowlist)",
    "packages/web/services/atom/api-atoms.shared.ts",
    "node_modules/.pnpm/x/node_modules/@tanstack/react-query/index.js",
  ],
  [
    "a pattern reaching a UI library",
    "packages/components/patterns/app-shell.tsx",
    "node_modules/.pnpm/x/node_modules/@radix-ui/react-dialog/dist/index.js",
  ],
  [
    "a pattern importing a feature",
    "packages/components/patterns/app-shell.tsx",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
  ],
  [
    "components importing web",
    "packages/components/primitives/button.tsx",
    "packages/web/services/atom/api-atoms.shared.ts",
  ],
  [
    "platform/api.ts → a module",
    "packages/server/src/platform/api.ts",
    `${M}/alpha/interface/http/index.ts`,
  ],
  [
    "cqrs runtime → a module's internals",
    "packages/server/src/platform/cqrs/cqrs-runtime.ts",
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "auth kernel → a module's internals",
    "packages/server/src/platform/auth/authz.ts",
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a middleware reaching past a barrel",
    "packages/server/src/platform/middlewares/auth-middleware-live.ts",
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "persistence → a module",
    "packages/server/src/platform/persistence/criteria-to-sql.ts",
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a module Layer → the database Live",
    `${M}/alpha/alpha.module.ts`,
    "packages/server/src/platform/database-live.ts",
  ],
  ["a barrel naming another module's barrel", `${M}/alpha/index.ts`, `${M}/beta/index.ts`],
  [
    "an interface util reaching for a command handler",
    `${M}/alpha/interface/http/x.util.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "a barrel re-exporting infrastructure",
    `${M}/alpha/index.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "a barrel re-exporting interface",
    `${M}/alpha/index.ts`,
    `${M}/alpha/interface/http/get.endpoint.ts`,
  ],
  [
    "server.ts reaching past a barrel",
    "packages/server/src/server.ts",
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "platform reaching past a barrel",
    "packages/server/src/platform/auth/authz.ts",
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a use case naming a top-level platform Live",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/server/src/platform/transaction-driver-live.ts",
  ],
  [
    "a command naming a notifications Live",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/server/src/platform/notifications/mailer-live.ts",
  ],
  [
    "module root file → @org/database",
    `${M}/alpha/alpha.module.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "module root file → @org/contracts",
    `${M}/alpha/alpha.module.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  ["barrel → effect", `${M}/alpha/index.ts`, NPM("effect")],
  [
    "event-handler → @org/database",
    `${M}/alpha/event-handlers/on.handler.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "event-handler → its own infrastructure",
    `${M}/alpha/event-handlers/on.handler.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "event-handler → its own queries",
    `${M}/alpha/event-handlers/on.handler.ts`,
    `${M}/alpha/queries/find.handler.ts`,
  ],
  [
    "repository Live → @org/contracts",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  [
    "repository Live → a third-party SDK",
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
    NPM("stripe"),
  ],
  [
    "client adapter → @org/database",
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "client adapter → an undeclared SDK",
    `${M}/alpha/infrastructure/clients/x.client-live.ts`,
    NPM("axios"),
  ],
  [
    "ACL adapter → a repository port",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${M}/alpha/domain/one/one.repository.ts`,
  ],
  [
    "ACL adapter → @org/database",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "endpoint → its own repositories",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "endpoint → @org/database",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "endpoint → an undeclared npm package",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    NPM("lodash"),
  ],
  [
    "util → @org/contracts",
    `${M}/alpha/interface/http/x.util.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  ["test → an undeclared npm package", `${M}/alpha/domain/one/one.root-ops.test.ts`, NPM("lodash")],
  [
    "platform/ids → the contracts package",
    "packages/server/src/platform/ids/user-id.ts",
    "packages/contracts/src/Policy.ts",
  ],
  ["platform/ids → a module", "packages/server/src/platform/ids/user-id.ts", `${M}/alpha/index.ts`],
  [
    "ddd/contracts → the event bus",
    "packages/server/src/platform/ddd/contracts/domain-event.ts",
    "packages/server/src/platform/ddd/event-bus.ts",
  ],
  [
    "ddd/contracts → @org/database",
    "packages/server/src/platform/ddd/contracts/domain-event.ts",
    "packages/database/src/index.ts",
  ],
  [
    "ddd/event-bus → the contracts tier",
    "packages/server/src/platform/ddd/event-bus.ts",
    "packages/server/src/platform/ddd/contracts/specification.ts",
  ],
  [
    "auth kernel → @org/database",
    "packages/server/src/platform/auth/authz.ts",
    "packages/database/src/index.ts",
  ],
  [
    "a mail transport → @org/database",
    "packages/server/src/platform/notifications/ses-mailer-live.ts",
    "packages/database/src/index.ts",
  ],
  [
    "a mail transport → an undeclared SDK",
    "packages/server/src/platform/notifications/ses-mailer-live.ts",
    NPM("mailgun"),
  ],
  [
    "persistence → @org/database",
    "packages/server/src/platform/persistence/criteria-to-sql.ts",
    "packages/database/src/index.ts",
  ],
  [
    "a top-level platform file → a module",
    "packages/server/src/platform/http-endpoint.ts",
    `${M}/alpha/index.ts`,
  ],
  [
    "an endpoint → the persistence helpers",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/server/src/platform/persistence/criteria-to-sql.ts",
  ],
  [
    "common → @org/contracts",
    "packages/server/src/common/env-vars.ts",
    "packages/contracts/src/Policy.ts",
  ],
  [
    "common → @org/database",
    "packages/server/src/common/token-cipher.ts",
    "packages/database/src/index.ts",
  ],
  [
    "common → the platform kernel",
    "packages/server/src/common/env-vars.ts",
    "packages/server/src/platform/ids/user-id.ts",
  ],
  ["common → a module barrel", "packages/server/src/common/env-vars.ts", `${M}/alpha/index.ts`],
  [
    "platform/api.ts → @org/database",
    "packages/server/src/platform/api.ts",
    "packages/database/src/index.ts",
  ],
  [
    "cqrs runtime → @org/database",
    "packages/server/src/platform/cqrs/cqrs-runtime.ts",
    "packages/database/src/index.ts",
  ],
  [
    "anything importing server.ts",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/server/src/server.ts",
  ],
  [
    "a test importing server.ts",
    "packages/server/src/test-utils/test-server.ts",
    "packages/server/src/server.ts",
  ],
  [
    "a test importing server.ts",
    "packages/server/src/test-utils/test-server.ts",
    "packages/server/src/server.ts",
  ],
  [
    "anything importing server.ts",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/server/src/server.ts",
  ],
  [
    "api-client reaching the server",
    "packages/api-client/src/client.ts",
    "packages/server/src/platform/api.ts",
  ],
  [
    "api-client reaching the database",
    "packages/api-client/src/client.ts",
    "packages/database/src/index.ts",
  ],
  [
    "the CLI reaching the server",
    "packages/cli/src/main.ts",
    "packages/server/src/platform/api.ts",
  ],
  [
    "the CLI reaching the database",
    "packages/cli/src/commands/todos.ts",
    "packages/database/src/index.ts",
  ],
  ["mcp reaching into the CLI", "packages/mcp/src/main.ts", "packages/cli/src/commands/todos.ts"],
  ["mcp reaching the server", "packages/mcp/src/main.ts", "packages/server/src/platform/api.ts"],
  [
    "jobs reaching the server",
    "packages/jobs/src/jobs/cleanup.ts",
    "packages/server/src/platform/api.ts",
  ],
  [
    "jobs reaching a module",
    "packages/jobs/src/jobs/cleanup.ts",
    "packages/server/src/modules/todos/index.ts",
  ],
  [
    "jobs reaching the contracts",
    "packages/jobs/src/jobs/cleanup.ts",
    "packages/contracts/src/Policy.ts",
  ],
  [
    "the database kernel reaching the contracts",
    "packages/database/src/Database.ts",
    "packages/contracts/src/Policy.ts",
  ],
  ["contracts reaching an undeclared package", "packages/contracts/src/Policy.ts", NPM("zod")],
];

// Edges the policy must ALLOW. These matter as much: a rule that refuses
// everything is as broken as one that refuses nothing.
const ALLOWED = [
  [
    "a domain-service composing two subdomains (LEGAL)",
    `${M}/alpha/domain/domain-services/x.domain-service.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a command handler using root-ops (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "a domain file importing effect (LEGAL)",
    `${M}/alpha/domain/one/one.root.ts`,
    "node_modules/.pnpm/effect@4/node_modules/effect/dist/Schema.js",
  ],
  [
    "a domain file importing node:crypto (LEGAL)",
    `${M}/alpha/domain/one/one.root.ts`,
    "node:crypto",
  ],
  [
    "a test file importing its harness (LEGAL)",
    `${M}/alpha/domain/one/one.root-ops.test.ts`,
    "node_modules/.pnpm/@effect+vitest@4/node_modules/@effect/vitest/dist/index.js",
  ],
  [
    "a command using its own domain (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    `${M}/alpha/domain/one/one.root-ops.ts`,
  ],
  [
    "a command using the CQRS library (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    "node_modules/.pnpm/x/node_modules/@effect-server-utils/cqrs/dist/esm/index.js",
  ],
  [
    "a command using a notifications port (LEGAL)",
    `${M}/alpha/commands/do.handler.ts`,
    "packages/server/src/platform/notifications/mailer.ts",
  ],
  ["a command using node:crypto (LEGAL)", `${M}/alpha/commands/do.handler.ts`, "node:crypto"],
  [
    "a query using a branded id (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/one/one.id.ts`,
  ],
  [
    "a query using its own ACL port (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "a query using @org/database (LEGAL)",
    `${M}/alpha/queries/find.handler.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "a repository Live using its own domain (LEGAL)",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    `${M}/alpha/domain/one/one.root.ts`,
  ],
  [
    "a repository Live using @org/database (LEGAL)",
    `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
    "packages/database/src/index.ts",
  ],
  [
    "an ACL adapter naming a foreign barrel (LEGAL)",
    `${M}/alpha/infrastructure/acl/beta.acl-live.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "a client adapter using a third-party SDK (LEGAL)",
    `${M}/alpha/infrastructure/clients/stripe.client-live.ts`,
    "node_modules/.pnpm/stripe@22/node_modules/stripe/esm/stripe.esm.node.js",
  ],
  [
    "an endpoint using its own commands (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    `${M}/alpha/commands/do.handler.ts`,
  ],
  [
    "an endpoint using @org/contracts (LEGAL)",
    `${M}/alpha/interface/http/get.endpoint.ts`,
    "packages/contracts/src/api/Users.ts",
  ],
  [
    "an event adapter naming a foreign barrel (LEGAL)",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/beta/index.ts`,
  ],
  [
    "an event adapter using its own command message (LEGAL)",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/alpha/commands/do.command.ts`,
  ],
  [
    "an event adapter using its own domain events (LEGAL)",
    `${M}/alpha/interface/events/beta.event-adapter.ts`,
    `${M}/alpha/domain/one/one.events.ts`,
  ],
  [
    "a policy dispatching its own query (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/queries/find.policy-query.ts`,
  ],
  [
    "a policy using its own ACL port (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    `${M}/alpha/domain/ports/acl/beta.acl.ts`,
  ],
  [
    "a policy using the authz DSL (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    "node_modules/.pnpm/x/node_modules/@effect-server-utils/authz/dist/esm/index.js",
  ],
  [
    "a policy using @org/contracts (LEGAL)",
    `${M}/alpha/policies/is-x.policy.ts`,
    "packages/contracts/src/Policy.ts",
  ],
  [
    "a saga using its own domain events (LEGAL)",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/domain/one/one.events.ts`,
  ],
  [
    "a saga using its own command message (LEGAL)",
    `${M}/alpha/sagas/x.saga.ts`,
    `${M}/alpha/commands/do.command.ts`,
  ],
  [
    "@org/database using the driver (LEGAL)",
    "packages/database/src/Database.ts",
    "node_modules/.pnpm/x/node_modules/@effect/sql-pg/dist/index.js",
  ],
  [
    "api-client using the contracts (LEGAL)",
    "packages/api-client/src/client.ts",
    "packages/contracts/src/CliApi.ts",
  ],
  [
    "the CLI using api-client (LEGAL)",
    "packages/cli/src/main.ts",
    "packages/api-client/src/index.ts",
  ],
  [
    "jobs using the database kernel (LEGAL)",
    "packages/jobs/src/jobs/cleanup.ts",
    "packages/database/src/index.ts",
  ],
  [
    "a View using a primitive (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/components/primitives/button.tsx",
  ],
  [
    "a View using its own ViewModel (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
  ],
  [
    "a View using effect/Schema (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view.tsx",
    "node_modules/.pnpm/effect@4/node_modules/effect/dist/Schema.js",
  ],
  [
    "a ViewModel using the Model (LEGAL)",
    "packages/web/features/orgs/org-picker/org-picker.view-model.ts",
    "packages/web/services/atom/api-atoms.shared.ts",
  ],
  [
    "a primitive using radix (LEGAL)",
    "packages/components/primitives/dialog.tsx",
    "node_modules/.pnpm/x/node_modules/@radix-ui/react-dialog/dist/index.js",
  ],
  [
    "a pattern using a primitive (LEGAL)",
    "packages/components/patterns/app-shell.tsx",
    "packages/components/primitives/button.tsx",
  ],
  [
    "a barrel re-exporting its domain (LEGAL)",
    `${M}/alpha/index.ts`,
    `${M}/alpha/domain/one/one.id.ts`,
  ],
  [
    "a module Layer naming its own adapters (LEGAL)",
    `${M}/alpha/alpha.module.ts`,
    `${M}/alpha/infrastructure/repositories/x.repository-live.ts`,
  ],
  [
    "a handler map naming a port (LEGAL)",
    `${M}/alpha/alpha.command-handlers.ts`,
    `${M}/alpha/domain/ports/clients/x.client.ts`,
  ],
  ["server.ts using a barrel (LEGAL)", "packages/server/src/server.ts", `${M}/alpha/index.ts`],
  [
    "a handler map naming a notifications Live (LEGAL)",
    `${M}/alpha/alpha.command-handlers.ts`,
    "packages/server/src/platform/notifications/mailer-live.ts",
  ],
];

// The graph rules, over small synthetic graphs. A per-edge row asks whether one
// import is refused; these ask what a whole shape means — a route through two
// files, a route that steps onto the mediating tier, a file nothing reaches.
// Each row names the rule expected to report, or `null` for a shape the rules
// must stay quiet on; a fourth element lists files that take part in the graph
// with no edge of their own.
const GRAPH = [
  [
    "a domain file reaching a repository Live through a sibling",
    "domain-reaches-no-adapter",
    [
      [`${M}/alpha/domain/one/one.root.ts`, `${M}/alpha/domain/one/one.specification.ts`],
      [
        `${M}/alpha/domain/one/one.specification.ts`,
        `${M}/alpha/infrastructure/repositories/one.repository-live.ts`,
      ],
    ],
  ],
  [
    "a domain test reaching a repository fake (LEGAL)",
    null,
    [
      [
        `${M}/alpha/domain/one/one.root-ops.test.ts`,
        `${M}/alpha/infrastructure/repositories/one.repository-fake.ts`,
      ],
    ],
  ],
  [
    "a command reaching an endpoint through its message",
    "use-cases-reach-no-adapter",
    [
      [`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/commands/do.command.ts`],
      [`${M}/alpha/commands/do.command.ts`, `${M}/alpha/interface/http/get.endpoint.ts`],
    ],
  ],
  [
    "a command reaching a port that reaches nothing (LEGAL)",
    null,
    [[`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/domain/one/one.repository.ts`]],
  ],
  [
    "the platform reaching a module Layer past its barrel",
    "platform-reaches-modules-only-through-barrels",
    [["packages/server/src/platform/cqrs/cqrs-runtime.ts", `${M}/alpha/alpha.module.ts`]],
  ],
  [
    "the platform reaching a module Layer through its barrel (LEGAL)",
    null,
    [
      ["packages/server/src/platform/cqrs/cqrs-runtime.ts", `${M}/alpha/index.ts`],
      [`${M}/alpha/index.ts`, `${M}/alpha/alpha.module.ts`],
    ],
  ],
  [
    "web reaching the server through the contracts package",
    "web-never-reaches-the-server",
    [
      ["packages/web/services/atom/api-atoms.shared.ts", "packages/contracts/src/Policy.ts"],
      ["packages/contracts/src/Policy.ts", "packages/server/src/common/env-vars.ts"],
    ],
  ],
  [
    "web reaching the contracts package (LEGAL)",
    null,
    [["packages/web/services/atom/api-atoms.shared.ts", "packages/contracts/src/Policy.ts"]],
  ],
  [
    "the contracts package reaching the database kernel",
    "contracts-reach-nothing",
    [["packages/contracts/src/Policy.ts", "packages/database/src/index.ts"]],
  ],
  [
    "two platform files importing each other",
    "no-cycles",
    [
      ["packages/server/src/platform/api.ts", "packages/server/src/platform/http-endpoint.ts"],
      ["packages/server/src/platform/http-endpoint.ts", "packages/server/src/platform/api.ts"],
    ],
  ],
  [
    "a domain file nothing imports",
    "no-orphans",
    [[`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/domain/one/one.repository.ts`]],
    [`${M}/alpha/domain/one/one.errors.ts`],
  ],
  [
    "a repository fake nothing imports (LEGAL)",
    null,
    [[`${M}/alpha/commands/do.handler.ts`, `${M}/alpha/domain/one/one.repository.ts`]],
    [`${M}/alpha/infrastructure/repositories/one.repository-fake.ts`],
  ],
];

// The lowered graph rules carry their patterns as regex sources; the evaluator
// takes them compiled.
const regexes = (patterns = []) => patterns.map((source) => new RegExp(source));
const graphRules = {
  cycles: lowered.graph.cycles.map((rule) => ({
    ...rule,
    within: regexes(rule.within),
    withinNot: regexes(rule.withinNot),
  })),
  orphans: lowered.graph.orphans.map((rule) => ({
    ...rule,
    within: regexes(rule.within),
    withinNot: regexes(rule.withinNot),
    entry: regexes(rule.entry),
  })),
  reach: lowered.graph.reach.map((rule) => ({
    ...rule,
    from: regexes(rule.from),
    fromNot: regexes(rule.fromNot),
    to: regexes(rule.to),
    toNot: regexes(rule.toNot),
    via: regexes(rule.via),
  })),
};

const graphOf = (edges, extraFiles = []) => {
  const files = new Set(extraFiles);
  const adjacency = new Map();
  for (const [from, to] of edges) {
    files.add(from);
    files.add(to);
    adjacency.set(from, [...(adjacency.get(from) ?? []), to]);
  }
  return { files: [...files].sort(), edges: adjacency };
};

const refuses = (from, to) => {
  const outcome = evaluateImportEdge(rules, makeModuleResolverFake({ "@probe": to }), {
    importer: from,
    specifier: "@probe",
  });
  return !Result.isFailure(outcome) && outcome.success.length > 0;
};

let wrong = 0;
const check = (label, from, to, expected) => {
  const actual = refuses(from, to);
  const ok = actual === expected;
  if (!ok) wrong += 1;
  process.stdout.write(
    `${ok ? "  " : "!!"} ${expected ? "refuse" : "allow "} ${actual === expected ? "ok " : "GOT " + (actual ? "refuse" : "allow")}  ${label}\n`,
  );
};

for (const [label, from, to] of REFUSED) check(label, from, to, true);
for (const [label, from, to] of ALLOWED) check(label, from, to, false);

let graphWrong = 0;
for (const [label, expected, edges, extraFiles = []] of GRAPH) {
  // The origin of a synthetic route is reached by nothing, so the orphans rule
  // is read only on the files a row lists as taking part without an edge.
  const names = [
    ...new Set(
      evaluateGraph(graphRules, graphOf(edges, extraFiles))
        .filter((v) => v.ruleName !== "no-orphans" || extraFiles.includes(v.file))
        .map((v) => v.ruleName),
    ),
  ];
  const ok = expected === null ? names.length === 0 : names.includes(expected);
  if (!ok) graphWrong += 1;
  process.stdout.write(
    `${ok ? "  " : "!!"} ${expected === null ? "quiet " : "report"} ${ok ? "ok " : `GOT ${names.length === 0 ? "quiet" : names.join(",")}`}  ${label}\n`,
  );
}

const total = REFUSED.length + ALLOWED.length;
process.stdout.write(
  wrong === 0
    ? `\nAll ${total} architecture edges hold (${REFUSED.length} refused, ${ALLOWED.length} allowed).\n`
    : `\n${wrong} of ${total} architecture edges changed verdict.\n`,
);
process.stdout.write(
  graphWrong === 0
    ? `All ${GRAPH.length} graph shapes hold.\n`
    : `${graphWrong} of ${GRAPH.length} graph shapes changed verdict.\n`,
);
process.exitCode = wrong === 0 && graphWrong === 0 ? 0 : 1;
