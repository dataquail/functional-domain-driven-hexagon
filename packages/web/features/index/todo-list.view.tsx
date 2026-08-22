"use client";

import { useAtomSuspense, useAtomValue } from "@effect/atom-react";
import { EmptyState } from "@org/components/patterns/empty-state";
import { List } from "@org/components/primitives/list";
import type { OrganizationId } from "@org/contracts/EntityIds";
import * as Array from "effect/Array";

import { TodoItem } from "./todo-item/todo-item.view";
import { todoListAtom, todosResultAtom } from "./todo-list.view-model";

export const TodoList: React.FC<{ orgId: OrganizationId }> = ({ orgId }) => {
  const todos = useAtomSuspense(todosResultAtom(orgId)).value;
  const { isEmpty } = useAtomValue(todoListAtom(orgId));

  if (isEmpty) {
    return <EmptyState message="No tasks yet. Add one above!" />;
  }

  return (
    <List gap="sm" data-testid="todo-list">
      {Array.map(todos, (todo) => (
        <List.Item key={todo.id}>
          <TodoItem todo={todo} orgId={orgId} />
        </List.Item>
      ))}
    </List>
  );
};
