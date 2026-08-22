// Org-scoped tasks page. The membership guard in the parent layout
// has already verified `orgId` belongs to the caller, so we trust
// the URL segment and feed it to the prefetch + leaf components.

import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { AddTodo } from "@/features/index/add-todo/add-todo.view";
import { TodoList } from "@/features/index/todo-list.view";
import { AtomHydrationBoundary } from "@/services/atom/hydration-boundary";
import { prefetchTodos } from "@/services/data-access/todos.server";

const SKELETON_COUNT = 3;

const Fallback: React.FC = () => (
  <Stack direction="column" gap="sm">
    {Array.from({ length: SKELETON_COUNT }, (_, index) => (
      <Skeleton key={index} height="row" />
    ))}
  </Stack>
);

export default async function OrgTasksPage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  return (
    <PageShell width="sm">
      <CardSection title="My Tasks" titleAlign="center" headerPadding="tight">
        <AddTodo orgId={orgId} />
        <AtomHydrationBoundary prefetch={[prefetchTodos(orgId)]} fallback={<Fallback />}>
          <TodoList orgId={orgId} />
        </AtomHydrationBoundary>
      </CardSection>
    </PageShell>
  );
}
