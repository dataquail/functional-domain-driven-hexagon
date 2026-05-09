// Tasks index. Phase 6 cutover wires the full mutation surface
// (AddTodo, TodoItem toggle/delete) on top of the Phase 4 read-side
// prefetch. Worker actions (filter, primes) from the SPA's view-model
// are intentionally not ported — academic for a template repo.

import { AddTodo } from "@/features/index/add-todo/add-todo";
import { TodoList } from "@/features/index/todo-list";
import { getQueryClient } from "@/lib/query-client.server";
import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { todosQuery, todosQueryKey } from "@/services/data-access/todos-queries";
import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import React from "react";

const SKELETON_COUNT = 3;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

export default async function TasksPage() {
  await prefetchEffectQuery({
    queryKey: todosQueryKey(),
    queryFn: todosQuery,
  });
  const queryClient = getQueryClient();

  return (
    <Card className="mx-auto w-full max-w-lg shadow-md">
      <Card.Header className="pb-2">
        <Card.Title className="text-center text-2xl font-semibold">My Tasks</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        <AddTodo />
        <HydrationBoundary state={dehydrate(queryClient)}>
          <React.Suspense fallback={<Fallback />}>
            <TodoList />
          </React.Suspense>
        </HydrationBoundary>
      </Card.Content>
    </Card>
  );
}
