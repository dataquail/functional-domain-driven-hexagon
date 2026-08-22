import "server-only";

import type { OrganizationId } from "@org/contracts/EntityIds";

import { prefetchQuery } from "@/services/atom/prefetch.server";

import { fetchTodos, todosQueryAtom } from "./todos.atoms";

export const prefetchTodos = (orgId: OrganizationId) =>
  prefetchQuery(todosQueryAtom(orgId), fetchTodos(orgId));
