// Super-admins own no organizations; their landing page is the platform-wide
// org admin view. Everyone else picks an organization here.
import { redirect } from "@sveltejs/kit";

import type { load as authedLoad } from "./+layout.server";

export const load = async ({
  parent,
}: {
  readonly parent: () => Promise<Awaited<ReturnType<typeof authedLoad>>>;
}) => {
  const { user } = await parent();

  if (user.isSuperAdmin) redirect(302, "/admin/orgs");

  return {};
};
