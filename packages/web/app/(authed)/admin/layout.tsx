// Super-admin gate for the `/admin/*` subtree. Non-SAs `notFound()`
// so the existence of admin pages doesn't leak via behavior. The pages
// inside still rely on the backend's policy gate (e.g. the org-admin
// `findAll` endpoint enforces super-admin) — this layout is the
// discoverability cut, not the security boundary.

import { notFound } from "next/navigation";
import * as React from "react";

import { fetchCurrentUser } from "@/services/data-access/me.server";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await fetchCurrentUser();
  if (me?.isSuperAdmin !== true) notFound();

  return <React.Fragment>{children}</React.Fragment>;
}
