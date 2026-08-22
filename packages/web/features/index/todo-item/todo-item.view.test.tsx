import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";

import { TodoItem } from "./todo-item.view";
import { deleteTodoActionAtom, toggleTodoAtom } from "./todo-item.view-model";

// An action atom starts pristine -- initial, and not waiting. Anything else
// means the View wrote to it. Asserting on that rather than on `waiting` keeps
// the test indifferent to whether the request has already settled.
const wasDispatched = (result: AsyncResult.AsyncResult<unknown, unknown>): boolean =>
  !AsyncResult.isInitial(result) || result.waiting;

describe("TodoItem view", () => {
  it("labels the checkbox with the todo's title and reflects its state", () => {
    renderView(<TodoItem orgId={TEST_ORG_ID} todo={makeTodo({ title: "Buy milk" })} />);

    expect(screen.getByRole("checkbox", { name: "Buy milk" })).not.toBeChecked();
  });

  it("shows a completed todo as checked", () => {
    renderView(
      <TodoItem orgId={TEST_ORG_ID} todo={makeTodo({ title: "Buy milk", completed: true })} />,
    );

    expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeChecked();
  });

  it("dispatches a toggle when the checkbox is clicked", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(
      <TodoItem orgId={TEST_ORG_ID} todo={makeTodo({ title: "Buy milk" })} />,
    );
    expect(wasDispatched(registry.get(toggleTodoAtom))).toBe(false);

    await user.click(screen.getByRole("checkbox", { name: "Buy milk" }));

    // The View's job ends at the write. Which way "toggle" flips the todo is
    // the ViewModel's business, and is asserted in its own test.
    expect(wasDispatched(registry.get(toggleTodoAtom))).toBe(true);
  });

  it("dispatches a delete when the delete control is clicked", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<TodoItem orgId={TEST_ORG_ID} todo={makeTodo()} />);
    expect(wasDispatched(registry.get(deleteTodoActionAtom))).toBe(false);

    await user.click(screen.getByTestId("todo-item-delete"));

    expect(wasDispatched(registry.get(deleteTodoActionAtom))).toBe(true);
  });
});
