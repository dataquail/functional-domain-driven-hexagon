import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { notificationAtom } from "@/services/atom/notifications.shared";
import {
  makeOrganization,
  makePaginatedOrganizations,
  ORG_B_ID,
} from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import {
  adminOrgsResultAtom,
  changePageAtom,
  includeDeletedAtom,
  orgsListAtom,
  PAGE_SIZE,
  pageAtom,
  restoreOrgActionAtom,
  softDeleteOrgActionAtom,
  toggleIncludeDeletedAtom,
} from "./orgs-list.view-model";

const DELETED_AT = DateTime.makeUnsafe(new Date("2026-02-03T00:00:00Z"));

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const settle = (registry: AtomRegistry.AtomRegistry) =>
  Effect.runPromise(
    AtomRegistry.getResult(registry, adminOrgsResultAtom, { suspendOnWaiting: true }),
  );

describe("admin orgs list ViewModel", () => {
  it("labels an active row and links it to its detail page", async () => {
    server.use(orgsHandlers.findAll([makeOrganization({ name: "Org A" })]));

    const registry = makeRegistry();
    await settle(registry);

    expect(registry.get(orgsListAtom).rows).toEqual([
      {
        id: makeOrganization().id,
        name: "Org A",
        createdAtLabel: "2026-01-01",
        isDeleted: false,
        deletedAtLabel: null,
        href: `/admin/orgs/${makeOrganization().id}`,
      },
    ]);
  });

  it("gives a soft-deleted row no link, since there is no page to visit", async () => {
    server.use(orgsHandlers.findAll([makeOrganization({ id: ORG_B_ID, deletedAt: DELETED_AT })]));

    const registry = makeRegistry();
    await settle(registry);

    expect(registry.get(orgsListAtom).rows[0]).toMatchObject({
      isDeleted: true,
      deletedAtLabel: "2026-02-03",
      href: null,
    });
  });

  it("derives pagination from the server's total, not the rows on this page", async () => {
    server.use(
      orgsHandlers.findAll(
        makePaginatedOrganizations({ organizations: [makeOrganization()], total: 25 }),
      ),
    );

    const registry = makeRegistry();
    await settle(registry);

    expect(registry.get(orgsListAtom)).toMatchObject({
      page: 1,
      total: 25,
      totalPages: 3,
      hasPrevious: false,
      hasNext: true,
    });
  });

  it("refetches the newly selected page", async () => {
    const requested: Array<number> = [];
    server.use(
      typedHandler(getEndpoint(OrganizationContract.AdminGroup, "findAll"), ({ urlParams }) => {
        requested.push(urlParams.page);
        return Effect.succeed(
          makePaginatedOrganizations({
            organizations: [makeOrganization()],
            page: urlParams.page,
            total: 25,
          }),
        );
      }),
    );

    const registry = makeRegistry();
    await settle(registry);
    expect(requested).toEqual([1]);

    registry.set(changePageAtom, "next");
    await settle(registry);

    expect(requested).toEqual([1, 2]);
  });

  it("returns to the first page when the deleted filter is flipped", async () => {
    const requested: Array<string | undefined> = [];
    server.use(
      typedHandler(getEndpoint(OrganizationContract.AdminGroup, "findAll"), ({ urlParams }) => {
        requested.push(urlParams.includeDeleted);
        return Effect.succeed(
          makePaginatedOrganizations({ organizations: [makeOrganization()], total: 25 }),
        );
      }),
    );

    const registry = makeRegistry();
    await settle(registry);
    registry.set(changePageAtom, "next");
    await settle(registry);
    expect(registry.get(pageAtom)).toBe(2);

    // Page 2 of the unfiltered list may not exist once deleted rows join it, so
    // the only page number that is always meaningful is the first.
    registry.set(toggleIncludeDeletedAtom, undefined);
    expect(registry.get(includeDeletedAtom)).toBe(true);
    expect(registry.get(pageAtom)).toBe(1);

    await settle(registry);
    expect(requested).toEqual(["false", "false", "true"]);
  });

  it("uses the whole page size the list was built for", () => {
    expect(PAGE_SIZE).toBe(10);
  });

  it("announces a soft delete", async () => {
    server.use(orgsHandlers.findAll([makeOrganization()]), orgsHandlers.softDelete());

    const registry = makeRegistry();
    await settle(registry);

    registry.set(softDeleteOrgActionAtom, makeOrganization().id);
    await Effect.runPromise(
      AtomRegistry.getResult(registry, softDeleteOrgActionAtom, { suspendOnWaiting: true }),
    );

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "success",
      message: "Organization deleted.",
    });
  });

  it("surfaces the server's refusal to restore an org that is not deleted", async () => {
    server.use(
      orgsHandlers.findAll([makeOrganization()]),
      orgsHandlers.restore({ result: "OrganizationNotDeletedError" }),
    );

    const registry = makeRegistry();
    await settle(registry);

    registry.set(restoreOrgActionAtom, makeOrganization().id);
    await Effect.runPromise(
      AtomRegistry.getResult(registry, restoreOrgActionAtom, { suspendOnWaiting: true }),
    ).catch(() => undefined);

    expect(registry.get(notificationAtom)).toMatchObject({
      kind: "error",
      message: "Organization is not deleted.",
    });
  });
});
