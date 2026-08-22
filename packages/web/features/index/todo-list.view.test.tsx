import type * as TodosContract from "@org/contracts/api/TodosContract";
import { TodoId } from "@org/contracts/EntityIds";
import { screen, within } from "@testing-library/react";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";

import { TodoList } from "./todo-list.view";
import { todosResultAtom } from "./todo-list.view-model";

const renderList = (todos: ReadonlyArray<TodosContract.Todo>) =>
  renderView(<TodoList orgId={TEST_ORG_ID} />, {
    initialValues: [[todosResultAtom(TEST_ORG_ID), AsyncResult.success(todos)]],
  });

describe("TodoList view", () => {
  it("renders one row per todo", () => {
    renderList([
      makeTodo({ title: "Buy milk" }),
      makeTodo({ id: TodoId.make("66666666-6666-6666-6666-666666666666"), title: "Walk the dog" }),
    ]);

    const list = screen.getByTestId("todo-list");
    expect(within(list).getAllByTestId("todo-item")).toHaveLength(2);
    expect(within(list).getByText("Buy milk")).toBeInTheDocument();
    expect(within(list).getByText("Walk the dog")).toBeInTheDocument();
  });

  it("shows the empty state instead of a list when the org has no todos", () => {
    renderList([]);

    expect(screen.getByText("No tasks yet. Add one above!")).toBeInTheDocument();
    expect(screen.queryByTestId("todo-list")).not.toBeInTheDocument();
  });
});
