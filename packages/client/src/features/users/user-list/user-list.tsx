import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { UsersQueries } from "@/services/data-access/users-queries";
import * as Array from "effect/Array";
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
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
          <div className="bg-muted/50 rounded-lg py-8 text-center">
            <p className="text-muted-foreground text-sm">No users yet.</p>
          </div>
        ) : (
          <ul className="space-y-2">
            {users.map((user) => (
              <li
                key={user.id}
                className="bg-card flex flex-col gap-1 rounded-md border p-3 transition-all hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-foreground truncate font-medium">{user.email}</p>
                    <Badge variant="secondary" className="capitalize">
                      {user.role}
                    </Badge>
                  </div>
                  <p className="text-muted-foreground truncate text-xs">
                    {user.address.street}, {user.address.postalCode} {user.address.country}
                  </p>
                </div>
                <p className="text-muted-foreground shrink-0 text-xs">
                  Joined {user.createdAt.toString().slice(0, 10)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="flex items-center justify-between">
        <p className="text-muted-foreground text-sm">
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
            <ChevronLeftIcon className="h-4 w-4" />
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
            <ChevronRightIcon className="h-4 w-4" />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
