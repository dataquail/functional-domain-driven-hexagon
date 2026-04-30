import { Badge } from "@/components/primitives/badge";
import { Button } from "@/components/primitives/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@/components/primitives/icon";
import { Skeleton } from "@/components/primitives/skeleton";
import { UsersQueries } from "@/services/data-access/users-queries";
import * as Array from "effect/Array";
import * as React from "react";

const PAGE_SIZE = 10;

export const UserList: React.FC = () => {
  const [page, setPage] = React.useState(1);
  const usersQuery = UsersQueries.useUsersQuery({ page, pageSize: PAGE_SIZE });

  const total = usersQuery.data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const users = usersQuery.data?.users ?? [];

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {usersQuery.isPending ? (
          Array.makeBy(PAGE_SIZE, (i) => <Skeleton key={i} className="h-16 w-full rounded-md" />)
        ) : users.length === 0 ? (
          <div className="rounded-lg bg-muted/50 py-8 text-center">
            <p className="text-sm text-muted-foreground">No users yet.</p>
          </div>
        ) : (
          <ul className="space-y-2" data-testid="user-list">
            {users.map((user) => (
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
            disabled={page <= 1 || usersQuery.isFetching}
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
            disabled={page >= totalPages || usersQuery.isFetching}
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
