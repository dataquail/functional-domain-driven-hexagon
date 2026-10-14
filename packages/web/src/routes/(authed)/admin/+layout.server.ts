// The /admin subtree 404s for anyone but a super-admin, so its existence does
// not leak. The backend's policies are the security boundary; this is the
// discoverability cut.
import { error } from "@sveltejs/kit";

import type { load as authedLoad } from "../+layout.server";

export const load = async ({
  parent,
}: {
  readonly parent: () => Promise<Awaited<ReturnType<typeof authedLoad>>>;
}) => {
  const { user } = await parent();

  if (!user.isSuperAdmin) error(404, "Not Found");

  return {};
};
