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

import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";
import * as Hydration from "effect/unstable/reactivity/Hydration";
import { describe, expect, it } from "vitest";

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

type Prefetchable = {
  readonly name: string;
  readonly atom: Atom.Atom<AsyncResult.AsyncResult<any, any>>;
  readonly value: unknown;
};

const PREFETCHABLE: ReadonlyArray<Prefetchable> = [
  {
    name: "users.find",
    atom: usersQueryAtom({ page: 1, pageSize: 10 }),
    value: makePaginatedUsers(),
  },
  { name: "todos.get", atom: todosQueryAtom(TEST_ORG_ID), value: [makeTodo()] },
  { name: "organization.findMine", atom: myOrgsQueryAtom, value: [makeMyOrganization()] },
  {
    name: "organizationAdmin.findAll",
    atom: adminOrgsQueryAtom({ page: 1, pageSize: 10, includeDeleted: "false" }),
    value: makePaginatedOrganizations(),
  },
  {
    name: "organization.findMembers",
    atom: orgMembersQueryAtom(ORG_A_ID),
    value: new OrganizationContract.OrganizationMembersResponse({
      members: [makeOrganizationMember()],
    }),
  },
  {
    name: "organization.findInvitations",
    atom: orgInvitationsQueryAtom(ORG_A_ID),
    value: new OrganizationContract.PendingInvitationsResponse({
      invitations: [makePendingInvitation()],
    }),
  },
  {
    name: "billing.getCurrentSubscription",
    atom: rawSubscriptionQueryAtom(BILLING_ORG_ID),
    value: makeSubscription(),
  },
];

describe("dehydrateQuery", () => {
  it.each(PREFETCHABLE)("dehydrates $name", ({ atom, value }) => {
    const [dehydrated] = Hydration.toValues([dehydrateQuery(atom, value)]) as [
      Hydration.DehydratedAtomValue,
    ];

    expect(dehydrated.key).toBeTypeOf("string");
    expect(dehydrated.value).toBeDefined();
  });

  it("refuses an atom that was never declared serializable, rather than silently skipping it", () => {
    // A query with no `serializationKey` is not hydratable, and the route that
    // prefetched it deserves to hear so rather than render a fallback and refetch
    // on the client for reasons nobody can see.
    const undeclared = Atom.make(AsyncResult.initial<number, never>());

    expect(() => dehydrateQuery(undeclared, 1)).toThrow(/carries no serialization metadata/);
  });
});
