import { AddTodo } from "@/features/index/add-todo/add-todo";
import { TodoList } from "@/features/index/todo-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { prefetchTodos } from "@/services/data-access/todos-queries.server";
import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import React from "react";

const SKELETON_COUNT = 3;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: SKELETON_COUNT }, (_, i) => (
      <Skeleton key={i} className="h-12 w-full rounded-md" />
    ))}
  </div>
);

export default function TasksPage() {
  return (
    <Card className="mx-auto w-full max-w-lg shadow-md">
      <Card.Header className="pb-2">
        <Card.Title className="text-center text-2xl font-semibold">My Tasks</Card.Title>
      </Card.Header>
      <Card.Content className="space-y-4">
        <AddTodo />
        <ServerHydrationBoundary prefetch={[prefetchTodos()]} fallback={<Fallback />}>
          <TodoList />
        </ServerHydrationBoundary>
      </Card.Content>
    </Card>
  );
}
