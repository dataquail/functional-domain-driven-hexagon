"use client";

import { Badge } from "@org/components/primitives/badge";
import { Button } from "@org/components/primitives/button";
import { ChevronLeftIcon, ChevronRightIcon } from "@org/components/primitives/icon";
import Link from "next/link";

import { useOrgsListPresenter } from "./orgs-list.presenter";

export const OrgsList: React.FC = () => {
  const {
    goNext,
    goPrev,
    hasNext,
    hasPrev,
    includeDeleted,
    isEmpty,
    onRestore,
    onSoftDelete,
    page,
    rows,
    toggleIncludeDeleted,
    total,
    totalPages,
  } = useOrgsListPresenter();

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={toggleIncludeDeleted}
          data-testid="orgs-toggle-deleted"
        >
          {includeDeleted ? "Hide deleted" : "Show deleted"}
        </Button>
        <p className="text-sm text-muted-foreground">{total} total</p>
      </div>

      {isEmpty ? (
        <div className="rounded-lg bg-muted/50 py-8 text-center">
          <p className="text-sm text-muted-foreground">No organizations.</p>
        </div>
      ) : (
        <ul className="space-y-2" data-testid="admin-orgs-list">
          {rows.map((row) => (
            <li
              key={row.id}
              data-testid="admin-orgs-row"
              data-org-id={row.id}
              className="flex items-center justify-between gap-3 rounded-md border bg-card p-3"
            >
              <div className="min-w-0 flex-1">
                {row.isDeleted ? (
                  <p className="truncate font-medium text-foreground">{row.name}</p>
                ) : (
                  <Link
                    href={`/admin/orgs/${row.id}`}
                    className="block truncate font-medium text-foreground hover:underline"
                    data-testid="admin-orgs-row-link"
                  >
                    {row.name}
                  </Link>
                )}
                <p className="text-xs text-muted-foreground">Created {row.createdAtLabel}</p>
                {row.isDeleted && row.deletedAtLabel !== null ? (
                  <p className="text-xs text-destructive">Deleted {row.deletedAtLabel}</p>
                ) : null}
              </div>
              <div className="flex shrink-0 items-center gap-2">
                {row.isDeleted ? (
                  <Badge variant="outline">Deleted</Badge>
                ) : (
                  <Badge variant="default">Active</Badge>
                )}
                {row.isDeleted ? (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    onClick={() => {
                      onRestore(row);
                    }}
                    data-testid="admin-orgs-restore"
                  >
                    Restore
                  </Button>
                ) : (
                  <Button
                    type="button"
                    size="sm"
                    variant="destructive"
                    onClick={() => {
                      onSoftDelete(row);
                    }}
                    data-testid="admin-orgs-delete"
                  >
                    Delete
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Page {page} of {totalPages}
        </p>
        <div className="flex items-center gap-2">
          <Button type="button" variant="outline" size="icon" disabled={!hasPrev} onClick={goPrev}>
            <ChevronLeftIcon />
            <span className="sr-only">Previous page</span>
          </Button>
          <Button type="button" variant="outline" size="icon" disabled={!hasNext} onClick={goNext}>
            <ChevronRightIcon />
            <span className="sr-only">Next page</span>
          </Button>
        </div>
      </div>
    </div>
  );
};
