// Inviting teammates is an org admin's; the invite endpoint refuses a member
// regardless, so this 404 is the clean UX rather than the boundary.
import { error } from "@sveltejs/kit";

import type { load as orgLoad } from "../+layout.server";

export const load = async ({
  parent,
}: {
  readonly parent: () => Promise<Awaited<ReturnType<typeof orgLoad>>>;
}) => {
  const { isAdmin } = await parent();
  if (!isAdmin) error(404, "Not Found");
  return {};
};
