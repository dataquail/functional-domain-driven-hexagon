// Users index. Phase 4 wires the server-side prefetch and the client
// suspense read. Page 1 of the user list is fetched on the server with
// the inbound cookie, dehydrated into the HTML, and hydrated by the
// browser's QueryClient — `useUsersSuspenseQuery` reads from cache on
// first paint, no client spinner.
//
// Pagination state stays client-side (`useState` in `<UserList>`):
// clicking next/prev causes Suspense to fall back to the skeleton
// while the new page fetches.

import { Card } from "@/components/primitives/card";
import { Skeleton } from "@/components/primitives/skeleton";
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
