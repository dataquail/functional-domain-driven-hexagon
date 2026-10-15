import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as AtomRegistry from "effect/reactivity/AtomRegistry";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { makeMyOrganization, ORG_B_ID } from "@/test/fixtures/organization";
import { orgsHandlers } from "@/test/handlers/orgs";
import { server } from "@/test/msw-server";
import { TEST_API_BASE } from "@/test/typed-handler";

import { myOrgsResultAtom, orgPickerAtom } from "./org-picker.view-model";

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const settle = (registry: AtomRegistry.AtomRegistry) =>
  AtomRegistry.getResult(registry, myOrgsResultAtom, { suspendOnWaiting: true });

describe("org picker ViewModel", () => {
  it.effect("turns each membership into a card that links into that org", () =>
    Effect.gen(function* () {
      server.use(
        orgsHandlers.findMine([
          makeMyOrganization({ name: "Org A" }),
          makeMyOrganization({ id: ORG_B_ID, name: "Org B" }),
        ]),
      );

      const registry = makeRegistry();
      yield* settle(registry);

      expect(registry.get(orgPickerAtom).cards).toEqual([
        { id: makeMyOrganization().id, name: "Org A", href: `/orgs/${makeMyOrganization().id}` },
        { id: ORG_B_ID, name: "Org B", href: `/orgs/${ORG_B_ID}` },
      ]);
    }),
  );

  it.effect("reports emptiness only once the list has actually arrived", () =>
    Effect.gen(function* () {
      server.use(orgsHandlers.findMine([]));

      const registry = makeRegistry();
      // "Not answered yet" must not render as "you belong to nothing" -- that
      // flashes a create-your-first-org prompt at someone who has several.
      expect(registry.get(orgPickerAtom).isEmpty).toBe(false);

      yield* settle(registry);

      expect(registry.get(orgPickerAtom).isEmpty).toBe(true);
    }),
  );
});
