// Org-scoped tasks page. The membership guard in the parent layout
// has already verified `orgId` belongs to the caller, so we trust
// the URL segment and feed it to the prefetch + leaf components.

import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { OrganizationId } from "@org/contracts/EntityIds";
import React from "react";

import { AddTodo } from "@/features/index/add-todo/add-todo.view";
import { TodoList } from "@/features/index/todo-list.view";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { prefetchTodos } from "@/services/data-access/todos-queries.server";

const SKELETON_COUNT = 3;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

export default async function OrgTasksPage({
  params,
}: {
  readonly params: Promise<{ readonly orgId: string }>;
}) {
  const { orgId: raw } = await params;
  const orgId = OrganizationId.make(raw);

  return (
    <Card className="mx-auto w-full max-w-lg shadow-md">
      <Card.Header className="pb-2">
        <Card.Title className="text-center text-2xl font-semibold">My Tasks</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        <AddTodo orgId={orgId} />
        <ServerHydrationBoundary prefetch={[prefetchTodos(orgId)]} fallback={<Fallback />}>
          <TodoList orgId={orgId} />
        </ServerHydrationBoundary>
      </Card.Content>
    </Card>
  );
}
