import { CreateUser } from "@/features/users/create-user/create-user";
import { UserList } from "@/features/users/user-list";
import { ServerHydrationBoundary } from "@/lib/tanstack-query/server-hydration-boundary";
import { prefetchUsers } from "@/services/data-access/users-queries.server";
import { Card } from "@org/components/primitives/card";
import { Skeleton } from "@org/components/primitives/skeleton";
import React from "react";

const PAGE_SIZE = 10;
const INITIAL_VARIABLES = { page: 1, pageSize: PAGE_SIZE } as const;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: PAGE_SIZE }, (_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-md" />
    ))}
  </div>
);

export default function UsersPage() {
  return (
    <div className="mx-auto w-full max-w-3xl space-y-4 px-4">
      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Create user</Card.Title>
        </Card.Header>
        <Card.Content>
          <CreateUser />
        </Card.Content>
      </Card>

      <Card className="shadow-md">
        <Card.Header>
          <Card.Title className="text-2xl font-semibold">Users</Card.Title>
        </Card.Header>
        <Card.Content>
          <ServerHydrationBoundary
            prefetch={[prefetchUsers(INITIAL_VARIABLES)]}
            fallback={<Fallback />}
          >
            <UserList />
          </ServerHydrationBoundary>
        </Card.Content>
      </Card>
    </div>
  );
}
