// ViewModel for the org switcher. Given the caller's organizations and the
// current pathname, derive the active org and the URL each option navigates to.
//
// The pathname → orgId extraction uses a literal regex (no path library) since
// the route shape is fixed: `/orgs/<uuid>/...`. The "switch" target replaces the
// orgId segment in place, preserving whatever sub-route the user is on
// (`/billing`, `/invite`, …) -- switching from one org's billing page to
// another's lands on the other's billing page.

import type { OrganizationId } from "@org/contracts/EntityIds";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import * as Atom from "effect/unstable/reactivity/Atom";

import { navigateTo, pathnameAtom } from "@/services/atom/navigation.shared";
import { myOrgsQueryAtom } from "@/services/data-access/orgs.atoms";

export type OrgOption = {
  readonly id: OrganizationId;
  readonly name: string;
  readonly href: string;
};

export type OrgSwitcherView = {
  readonly activeOrgId: OrganizationId | null;
  readonly options: ReadonlyArray<OrgOption>;
  readonly isEmpty: boolean;
};

// Group 2 always matches (the empty string when there's no sub-route), so the
// template literal in `buildHref` never interpolates `undefined`.
const ORG_PATH_PATTERN = /^\/orgs\/([^/]+)(.*)$/;

export const extractActiveOrgId = (pathname: string): string | null => {
  const match = ORG_PATH_PATTERN.exec(pathname);
  if (match === null) return null;
  return match[1];
};

const buildHref = (orgId: OrganizationId, pathname: string): string => {
  const match = ORG_PATH_PATTERN.exec(pathname);
  // Off any /orgs/<id>/<rest> path, swap the id and preserve the rest.
  // From any other path (root, /users, /admin/orgs) land at the org root.
  if (match !== null) {
    return `/orgs/${orgId}${match[2]}`;
  }
  return `/orgs/${orgId}`;
};

export const computeOrgSwitcherView = (input: {
  readonly orgs: ReadonlyArray<{ readonly id: OrganizationId; readonly name: string }>;
  readonly pathname: string;
}): OrgSwitcherView => {
  const activeId = extractActiveOrgId(input.pathname);
  const options = input.orgs.map((org) => ({
    id: org.id,
    name: org.name,
    href: buildHref(org.id, input.pathname),
  }));
  const activeOrgId =
    activeId !== null
      ? (options.find((o) => o.id === (activeId as OrganizationId))?.id ?? null)
      : null;
  return { activeOrgId, options, isEmpty: options.length === 0 };
};

export const orgSwitcherResultAtom = Atom.make((get) => get(myOrgsQueryAtom));

export const orgSwitcherAtom = Atom.make((get): OrgSwitcherView => {
  const result = get(orgSwitcherResultAtom);
  return computeOrgSwitcherView({
    orgs: AsyncResult.isSuccess(result) ? result.value : [],
    pathname: get(pathnameAtom),
  });
});

export const selectOrgAtom = Atom.fnSync<OrganizationId>()((orgId, get) => {
  const option = get(orgSwitcherAtom).options.find((o) => o.id === orgId);
  if (option === undefined) return;
  navigateTo(get, option.href);
});

export const createNewOrgAtom = Atom.fnSync<void>()((_, get) => {
  navigateTo(get, "/");
});
