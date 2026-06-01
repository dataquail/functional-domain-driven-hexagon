import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import React from "react";

import { AddTodo } from "@/features/index/add-todo/add-todo";
import { TodoList } from "@/features/index/todo-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { ensurePrimaryOrgId } from "@/services/data-access/primary-org.server";
import { prefetchTodos } from "@/services/data-access/todos-queries.server";

const SKELETON_COUNT = 3;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

// Phase 5 bridge: contract paths are now `/orgs/:orgId/todos`, but the
// route surface still lives at `/`. Resolve the caller's primary org
// server-side (auto-creating "My Workspace" on first sign-in) and
// thread the id down through prefetch + the two client features.
// Phase 8 will replace this with `/orgs/[orgId]/todos` and read orgId
// from the URL segment.
export default async function TasksPage() {
  const orgId = await ensurePrimaryOrgId();

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
