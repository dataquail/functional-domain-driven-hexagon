// ViewModel for the root organization picker. The list is not paginated --
// `findMine` returns the caller's memberships and nothing else, and a user with
// hundreds of organizations is outside the shape this app is built for.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Array from "effect/Array";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { myOrgsQueryAtom } from "@/services/data-access/orgs.atoms";

export const myOrgsResultAtom = Atom.make((get) => get(myOrgsQueryAtom));

export type OrgCard = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly href: string;
};

export type OrgPickerView = {
  readonly cards: ReadonlyArray<OrgCard>;
  readonly isEmpty: boolean;
};

export const orgPickerAtom = Atom.make((get): OrgPickerView => {
  const result = get(myOrgsResultAtom);
  const orgs = AsyncResult.isSuccess(result) ? result.value : [];
  return {
    cards: Array.map(orgs, (org) => ({
      id: org.id,
      name: org.name,
      href: `/orgs/${org.id}`,
    })),
    isEmpty: AsyncResult.isSuccess(result) && Array.isReadonlyArrayEmpty(orgs),
  };
});
