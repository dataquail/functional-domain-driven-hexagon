// Users index. Phase 6 cutover wires the full mutation surface
// (CreateUser presenter) on top of the Phase 4 read-side prefetch.

import { Card } from "@/components/primitives/card";
import { Skeleton } from "@/components/primitives/skeleton";
import { CreateUser } from "@/features/users/create-user/create-user";
import { UserList } from "@/features/users/user-list";
import { getQueryClient } from "@/lib/query-client.server";
import { prefetchEffectQuery } from "@/lib/tanstack-query/effect-prefetch.server";
import { usersQuery, usersQueryKey } from "@/services/data-access/users-queries";
import { dehydrate, HydrationBoundary } from "@tanstack/react-query";
import { Suspense } from "react";

const PAGE_SIZE = 10;
const INITIAL_VARIABLES = { page: 1, pageSize: PAGE_SIZE } as const;

const Fallback: React.FC = () => (
  <div className="space-y-2">
    {Array.from({ length: PAGE_SIZE }, (_, i) => (
      <Skeleton key={i} className="h-16 w-full rounded-md" />
    ))}
  </div>
);

export default async function UsersPage() {
  await prefetchEffectQuery({
    queryKey: usersQueryKey(INITIAL_VARIABLES),
    queryFn: usersQuery(INITIAL_VARIABLES),
  });
  const queryClient = getQueryClient();

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
          <HydrationBoundary state={dehydrate(queryClient)}>
            <Suspense fallback={<Fallback />}>
              <UserList />
            </Suspense>
          </HydrationBoundary>
        </Card.Content>
      </Card>
    </div>
  );
}
