import {
  CommandBus,
  makeCommandBus,
  makeEventBus,
  makeQueryBus,
  makeUnhandledFailures,
  makeUnitOfWork,
  mergeDispatchTables,
  QueryBus,
} from "@effect-server-utils/cqrs";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import {
  authCommandGroup,
  AuthCommands,
  AuthQueries,
  authQueryGroup,
} from "@/modules/auth/index.js";
import {
  billingCommandGroup,
  BillingCommands,
  billingEventSpanAttributes,
  BillingQueries,
  billingQueryGroup,
} from "@/modules/billing/index.js";
import {
  organizationCommandGroup,
  OrganizationCommands,
  organizationEventSpanAttributes,
  OrganizationQueries,
  organizationQueryGroup,
} from "@/modules/organization/index.js";
import { roleCommandGroup, RoleCommands, roleEventSpanAttributes } from "@/modules/role/index.js";
import {
  todoCommandGroup,
  TodoCommands,
  TodoQueries,
  todoQueryGroup,
} from "@/modules/todos/index.js";
import {
  userCommandGroup,
  UserCommands,
  userEventSpanAttributes,
  UserQueries,
  userQueryGroup,
} from "@/modules/user/index.js";
import {
  walletCommandGroup,
  WalletCommands,
  walletEventSpanAttributes,
} from "@/modules/wallet/index.js";
import { TransactionDriverLive } from "@/platform/transaction-driver-live.js";

// The parts of the composition root that production and the test runtime share
// verbatim. Only the module *ordering* differs between them (the test runtime
// takes billing's fake gateway), so that stays stated in each root — an ordering
// is a configuration, and the two configurations are legitimately different.
//
// This file is a composition root: it is where the bus factories and the DDD
// kernel Lives are allowed to be named.

// `CommandBus`/`QueryBus` route by tag across the per-module dispatch surfaces. A
// dispatch site names the bus and the message definition; which module answers a
// tag is settled here, once.
//
// `declaredIn` is what turns a forgotten module into a startup failure. Without
// it, a dispatch surface that was never merged still type-checks at every call
// site and dies on the first dispatch of one of its tags — which could be a
// rarely-exercised endpoint in production. The lists are adjacent on purpose: a
// module added to one and not the other is visible in review, and the completeness
// test covers the case where it is missed in both.
export const CommandBusLive = Layer.effect(
  CommandBus,
  Effect.gen(function* () {
    const wallet = yield* WalletCommands;
    const user = yield* UserCommands;
    const organization = yield* OrganizationCommands;
    const auth = yield* AuthCommands;
    const todos = yield* TodoCommands;
    const role = yield* RoleCommands;
    const billing = yield* BillingCommands;
    return makeCommandBus(
      mergeDispatchTables(wallet, user, organization, auth, todos, role, billing),
      {
        declaredIn: [
          walletCommandGroup,
          userCommandGroup,
          organizationCommandGroup,
          authCommandGroup,
          todoCommandGroup,
          roleCommandGroup,
          billingCommandGroup,
        ],
      },
    );
  }),
);

export const QueryBusLive = Layer.effect(
  QueryBus,
  Effect.gen(function* () {
    const organization = yield* OrganizationQueries;
    const auth = yield* AuthQueries;
    const user = yield* UserQueries;
    const todos = yield* TodoQueries;
    const billing = yield* BillingQueries;
    // `roleQueryGroup` is deliberately absent from both lists. Its one member is a
    // policy-query (ADR-0022): a cross-module contract reached only through a
    // consumer's own ACL adapter against `RoleQueries`, never routed by tag. So
    // `declaredIn` means "the groups this bus is meant to route", not "every group
    // the application declares" — a module may own a group its own dispatch surface
    // is the only server of.
    return makeQueryBus(mergeDispatchTables(organization, auth, user, todos, billing), {
      declaredIn: [
        organizationQueryGroup,
        authQueryGroup,
        userQueryGroup,
        todoQueryGroup,
        billingQueryGroup,
      ],
    });
  }),
);

// One bus for both consistency models: a subscriber picks whether it runs in the
// publisher's transaction or after it commits, so a producer never decides that on
// behalf of a module it is not allowed to know about.
export const DomainEventBusLive = makeEventBus({
  spanAttributes: {
    ...userEventSpanAttributes,
    ...walletEventSpanAttributes,
    ...roleEventSpanAttributes,
    ...organizationEventSpanAttributes,
    ...billingEventSpanAttributes,
  },
});

// Post-commit reactions are isolated, so their failures reach no request and no
// caller. This gives them somewhere to be observed besides a log line.
export const UnhandledFailuresLive = makeUnhandledFailures();

// The boundary's semantics live in `@effect-server-utils/cqrs`; `TransactionDriverLive` is the
// only piece that knows they are implemented as a SQL transaction.
export const UnitOfWorkLive = makeUnitOfWork().pipe(Layer.provide(TransactionDriverLive));
