"use client";

// Phase 4 port of packages/client/src/features/users/user-list/user-list.tsx.
// Differences from the SPA version:
//   - `useEffectQuery` → `useEffectSuspenseQuery`. Page 1 is hydrated
//     from the server prefetch (no client spinner on first paint);
//     subsequent pages refetch via Suspense (the existing skeleton
//     fallback comes from `<Suspense fallback>` in the page, not from
//     `usersQuery.isPending` here).
//   - The pagination state is unchanged — `useState` per the plan's
//     "pagination/state-driven queries stay client-side" note.
//   - There's no `isFetching`-disabled state on the buttons because
//     suspense handles the in-flight UX above us.

import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/primitives/icon";
import { useUsersSuspenseQuery } from "@/services/data-access/use-users-queries";
import * as Array from "effect/Array";
import * as React from "react";

const PAGE_SIZE = 10;

export const UserList: React.FC = () => {
  const [page, setPage] = React.useState(1);
  const usersQuery = useUsersSuspenseQuery({ page, pageSize: PAGE_SIZE });

  const total = usersQuery.data.total;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const users = usersQuery.data.users;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {users.length === 0 ? (
          <div className="rounded-lg bg-muted/50 py-8 text-center">
            <p className="text-sm text-muted-foreground">No users yet.</p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="user-list">
            {Array.map(users, (user) => (
              <li
                key={user.id}
                data-testid="user-list-item"
                data-user-email={user.email}
                className="flex flex-col gap-1 rounded-md border bg-card p-3 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate font-medium text-foreground">{user.email}</p>
                    <Badge variant="secondary" className="capitalize">
                      {user.role}
                    </Badge>
                  </div>
                  <p className="truncate text-xs text-muted-foreground">
                    {user.address.street}, {user.address.postalCode} {user.address.country}
                  </p>
                </div>
                <p className="shrink-0 text-xs text-muted-foreground">
                  Joined {user.createdAt.toString().slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages} · {total} total
        </p>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page <= 1}
            onClick={() => {
              setPage((p) => Math.max(1, p - 1));
            }}
          >
            <ChevronLeftIcon />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            disabled={page >= totalPages}
            onClick={() => {
              setPage((p) => Math.min(totalPages, p + 1));
            }}
          >
            <ChevronRightIcon />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
