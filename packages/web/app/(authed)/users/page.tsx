import { CardSection } from "@org/components/patterns/card-section";
import { PageShell } from "@org/components/patterns/page-shell";
import { Skeleton } from "@org/components/primitives/skeleton";
import { Stack } from "@org/components/primitives/stack";
import React from "react";

import { CreateUser } from "@/features/users/create-user/create-user.view";
import { UserList } from "@/features/users/user-list.view";
import { PAGE_SIZE } from "@/features/users/user-list.view-model";
import { AtomHydrationBoundary } from "@/services/atom/hydration-boundary";
import { prefetchUsers } from "@/services/data-access/users.server";

const INITIAL_VARIABLES = { page: 1, pageSize: PAGE_SIZE } as const;

const Fallback: React.FC = () => (
  <Stack direction="column" gap="sm">
    {Array.from({ length: PAGE_SIZE }, (_, index) => (
      <Skeleton key={index} height="row" />
    ))}
  </Stack>
);

export default function UsersPage() {
  return (
    <PageShell>
      <CardSection title="Create user">
        <CreateUser />
      </CardSection>

      <CardSection title="Users">
        <AtomHydrationBoundary
          prefetch={[prefetchUsers(INITIAL_VARIABLES)]}
          fallback={<Fallback />}
        >
          <UserList />
        </AtomHydrationBoundary>
      </CardSection>
    </PageShell>
  );
}
