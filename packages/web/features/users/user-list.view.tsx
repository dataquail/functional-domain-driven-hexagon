"use client";

import { useAtomSet, useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { EmptyState } from "@org/components/patterns/empty-state";
import { Pagination } from "@org/components/patterns/pagination";
import { List } from "@org/components/primitives/list";
import { Stack } from "@org/components/primitives/stack";
import { Surface } from "@org/components/primitives/surface";
import { Text } from "@org/components/primitives/text";
import type { UserContract } from "@org/contracts/api/Contracts";
import * as Array from "effect/Array";

import { changePageAtom, paginationAtom, usersResultAtom } from "./user-list.view-model";

const describeAddress = (user: UserContract.User): string =>
  user.address !== null
    ? `${user.address.street}, ${user.address.postalCode} ${user.address.country}`
    : "No address on file";

export const UserList: React.FC = () => {
  const users = useAtomSuspense(usersResultAtom).value.users;
  const pagination = useAtomValue(paginationAtom);
  const changePage = useAtomSet(changePageAtom);

  return (
    <Stack direction="column" gap="lg">
      {pagination.isEmpty ? (
        <EmptyState message="No users yet." />
      ) : (
        <List gap="sm" data-testid="user-list">
          {Array.map(users, (user) => (
            <List.Item key={user.id}>
              <Surface
                tone="card"
                radius="md"
                border="all"
                padding="md"
                interactive="raise"
                data-testid="user-list-item"
              >
                <Stack
                  direction="column"
                  directionAbove="row"
                  gap="xs"
                  justify="between"
                  align="start"
                >
                  <Stack direction="column" grow shrinkBelowContent>
                    <Text weight="medium" truncate>
                      {user.email}
                    </Text>
                    <Text size="xs" tone="muted" truncate>
                      {describeAddress(user)}
                    </Text>
                  </Stack>
                  <Text size="xs" tone="muted">
                    Joined {user.createdAt.toString().slice(0, 10)}
                  </Text>
                </Stack>
              </Surface>
            </List.Item>
          ))}
        </List>
      )}

      <Pagination
        page={pagination.page}
        totalPages={pagination.totalPages}
        total={pagination.total}
        hasPrevious={pagination.hasPrevious}
        hasNext={pagination.hasNext}
        onPrevious={() => {
          changePage("previous");
        }}
        onNext={() => {
          changePage("next");
        }}
        itemLabel="total"
      />
    </Stack>
  );
};
