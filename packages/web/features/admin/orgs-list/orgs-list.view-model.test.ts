import { describe, expect, it } from "@effect/vitest";
import * as OrganizationContract from "@org/contracts/api/OrganizationContract";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

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

const DELETED_AT = DateTime.makeUnsafe("2026-02-03T00:00:00Z");

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const settle = (registry: AtomRegistry.AtomRegistry) =>
  AtomRegistry.getResult(registry, adminOrgsResultAtom, { suspendOnWaiting: true });

describe("admin orgs list ViewModel", () => {
  it.effect("labels an active row and links it to its detail page", () =>
    Effect.gen(function* () {
      server.use(orgsHandlers.findAll([makeOrganization({ name: "Org A" })]));

      const registry = makeRegistry();
      yield* settle(registry);

      expect(registry.get(orgsListAtom).rows).toEqual([
        {
          id: makeOrganization().id,
          name: "Org A",
          createdAtLabel: "2026-01-01",
          isDeleted: false,
          href: `/admin/orgs/${makeOrganization().id}`,
        },
      ]);
    }),
  );

  it.effect("gives a soft-deleted row no link, since there is no page to visit", () =>
    Effect.gen(function* () {
      server.use(orgsHandlers.findAll([makeOrganization({ id: ORG_B_ID, deletedAt: DELETED_AT })]));

      const registry = makeRegistry();
      yield* settle(registry);

      const [row] = registry.get(orgsListAtom).rows;
      expect(row).toMatchObject({ isDeleted: true, deletedAtLabel: "2026-02-03" });
      expect(row).not.toHaveProperty("href");
    }),
  );

  it.effect("derives pagination from the server's total, not the rows on this page", () =>
    Effect.gen(function* () {
      server.use(
        orgsHandlers.findAll(
          makePaginatedOrganizations({ organizations: [makeOrganization()], total: 25 }),
        ),
      );

      const registry = makeRegistry();
      yield* settle(registry);

      expect(registry.get(orgsListAtom)).toMatchObject({
        page: 1,
        total: 25,
        totalPages: 3,
        hasPrevious: false,
        hasNext: true,
      });
    }),
  );

  it.effect("refetches the newly selected page", () =>
    Effect.gen(function* () {
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
      yield* settle(registry);
      expect(requested).toEqual([1]);

      registry.set(changePageAtom, "next");
      yield* settle(registry);

      expect(requested).toEqual([1, 2]);
    }),
  );

  it.effect("returns to the first page when the deleted filter is flipped", () =>
    Effect.gen(function* () {
      const requested: Array<OrganizationContract.FindAllOrganizationsParams["includeDeleted"]> =
        [];

      server.use(
        typedHandler(getEndpoint(OrganizationContract.AdminGroup, "findAll"), ({ urlParams }) => {
          requested.push(urlParams.includeDeleted);

          return Effect.succeed(
            makePaginatedOrganizations({ organizations: [makeOrganization()], total: 25 }),
          );
        }),
      );

      const registry = makeRegistry();
      yield* settle(registry);
      registry.set(changePageAtom, "next");
      yield* settle(registry);
      expect(registry.get(pageAtom)).toBe(2);

      // Page 2 of the unfiltered list may not exist once deleted rows join it, so
      // the only page number that is always meaningful is the first.
      registry.set(toggleIncludeDeletedAtom, void 0);
      expect(registry.get(includeDeletedAtom)).toBe(true);
      expect(registry.get(pageAtom)).toBe(1);

      yield* settle(registry);
      expect(requested).toEqual(["false", "false", "true"]);
    }),
  );

  it("uses the whole page size the list was built for", () => {
    expect(PAGE_SIZE).toBe(10);
  });

  it.effect("announces a soft delete", () =>
    Effect.gen(function* () {
      server.use(orgsHandlers.findAll([makeOrganization()]), orgsHandlers.softDelete());

      const registry = makeRegistry();
      yield* settle(registry);

      registry.set(softDeleteOrgActionAtom, makeOrganization().id);
      yield* AtomRegistry.getResult(registry, softDeleteOrgActionAtom, { suspendOnWaiting: true });

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "success",
        message: "Organization deleted.",
      });
    }),
  );

  it.effect("surfaces the server's refusal to restore an org that is not deleted", () =>
    Effect.gen(function* () {
      server.use(
        orgsHandlers.findAll([makeOrganization()]),
        orgsHandlers.restore({ result: "OrganizationNotDeletedError" }),
      );

      const registry = makeRegistry();
      yield* settle(registry);

      registry.set(restoreOrgActionAtom, makeOrganization().id);
      yield* Effect.exit(
        AtomRegistry.getResult(registry, restoreOrgActionAtom, { suspendOnWaiting: true }),
      );

      expect(Option.getOrThrow(registry.get(notificationAtom))).toMatchObject({
        kind: "error",
        message: "Organization is not deleted.",
      });
    }),
  );
});
