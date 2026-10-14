// Every query a route can prefetch must be dehydratable.
//
// This exists because it did not, and the gap cost a green CI run: the spike
// test declared its own query atom without `reactivityKeys`, a configuration no
// feature uses, so it proved hydration worked for a shape that never ships.
// Every real query declares both `reactivityKeys` and `serializationKey`, and
// the reactivity wrapper does not carry the serialization metadata -- so server
// prefetch threw on every page while the whole unit suite stayed green.
//
// The table is the point: a new query atom that forgets `serializationKey`, or
// an upstream change to how `AtomHttpApi` wraps one, fails here rather than in
// an acceptance run.

import { describe, expect, it } from "@effect/vitest";
import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import * as Effect from "effect/Effect";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Hydration from "effect/reactivity/Hydration";

import { rawSubscriptionQueryAtom } from "@/services/data-access/billing.atoms";
import {
  orgInvitationsQueryAtom,
  orgMembersQueryAtom,
} from "@/services/data-access/org-members.atoms";
import { adminOrgsQueryAtom, myOrgsQueryAtom } from "@/services/data-access/orgs.atoms";
import { todosQueryAtom } from "@/services/data-access/todos.atoms";
import { usersQueryAtom } from "@/services/data-access/users.atoms";
import { BILLING_ORG_ID, makeSubscription } from "@/test/fixtures/billing";
import {
  makeMyOrganization,
  makeOrganizationMember,
  makePaginatedOrganizations,
  makePendingInvitation,
  ORG_A_ID,
} from "@/test/fixtures/organization";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { makePaginatedUsers } from "@/test/fixtures/user";

import { dehydrateQuery } from "./dehydration.shared";

const prefetchable = <A, E>(
  name: string,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
  value: A,
) => ({ name, dehydrate: () => dehydrateQuery(atom, value) });

const PREFETCHABLE = [
  prefetchable("users.find", usersQueryAtom({ page: 1, pageSize: 10 }), makePaginatedUsers()),
  prefetchable("todos.get", todosQueryAtom(TEST_ORG_ID), [makeTodo()]),
  prefetchable("organization.findMine", myOrgsQueryAtom, [makeMyOrganization()]),
  prefetchable(
    "organizationAdmin.findAll",
    adminOrgsQueryAtom({ page: 1, pageSize: 10, includeDeleted: "false" }),
    makePaginatedOrganizations(),
  ),
  prefetchable(
    "organization.findMembers",
    orgMembersQueryAtom(ORG_A_ID),
    new OrganizationContract.OrganizationMembersResponse({ members: [makeOrganizationMember()] }),
  ),
  prefetchable(
    "organization.findInvitations",
    orgInvitationsQueryAtom(ORG_A_ID),
    new OrganizationContract.PendingInvitationsResponse({
      invitations: [makePendingInvitation()],
    }),
  ),
  prefetchable(
    "billing.getCurrentSubscription",
    rawSubscriptionQueryAtom(BILLING_ORG_ID),
    makeSubscription(),
  ),
];

describe("dehydrateQuery", () => {
  it.effect.each(PREFETCHABLE)("dehydrates $name", ({ dehydrate }) =>
    Effect.gen(function* () {
      const entries = Hydration.toValues([yield* dehydrate()]);

      expect(entries).toHaveLength(1);
      expect(entries[0]?.key).toBeTypeOf("string");
      expect(entries[0]).toHaveProperty("value");
    }),
  );

  it.effect(
    "refuses an atom that was never declared serializable, rather than silently skipping it",
    () =>
      Effect.gen(function* () {
        // A query with no `serializationKey` is not hydratable, and the route that
        // prefetched it deserves to hear so rather than render a fallback and refetch
        // on the client for reasons nobody can see.
        const undeclared = Atom.make(AsyncResult.initial<number, never>());

        const error = yield* Effect.flip(dehydrateQuery(undeclared, 1));

        expect(error.message).toMatch(/carries no serialization metadata/);
      }),
  );
});
