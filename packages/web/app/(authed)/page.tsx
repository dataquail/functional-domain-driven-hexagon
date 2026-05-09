// Tasks index. Phase 4 follow-up wires the server-side prefetch and
// the client suspense read for the read side. Mutations (add/toggle/
// delete) and worker actions (filter, primes) land at Phase 6 cutover
// when the existing client's mutation tier moves over.

import { Card } from "@/components/primitives/card";
import { Skeleton } from "@/components/primitives/skeleton";
import { TodoList } from "@/features/index/todo-list";
import { getQueryClient } from "@/lib/query-client.server";
import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { todosQuery, todosQueryKey } from "@/services/data-access/todos-queries";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

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
        <HydrationBoundary state={dehydrate(queryClient)}>
          <Suspense fallback={<Fallback />}>
            <TodoList />
          </Suspense>
        </HydrationBoundary>
      </Card.Content>
    </Card>
  );
}
