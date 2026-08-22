import { screen } from "@testing-library/react";
import { userEvent } from "@testing-library/user-event";
import * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import { describe, expect, it } from "vitest";

import { renderView } from "@/test/atom-harness";
import { TEST_ORG_ID } from "@/test/fixtures/todo";

import { AddTodo } from "./add-todo.view";
import { fieldsAtom, submitAtom, submitAttemptedAtom } from "./add-todo.view-model";

describe("AddTodo view", () => {
  it("renders the title held in the ViewModel", () => {
    renderView(<AddTodo orgId={TEST_ORG_ID} />, {
      initialValues: [[fieldsAtom, { title: "Buy milk" }]],
    });

    expect(screen.getByTestId("add-todo-input")).toHaveValue("Buy milk");
  });

  it("writes each keystroke back to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<AddTodo orgId={TEST_ORG_ID} />);

    await user.type(screen.getByTestId("add-todo-input"), "Walk the dog");

    expect(registry.get(fieldsAtom).title).toBe("Walk the dog");
  });

  it("shows no error before a submit attempt", () => {
    renderView(<AddTodo orgId={TEST_ORG_ID} />);
    expect(screen.queryAllByRole("alert")).toHaveLength(0);
  });

  it("shows the error once submission has been attempted with a blank title", () => {
    renderView(<AddTodo orgId={TEST_ORG_ID} />, {
      initialValues: [[submitAttemptedAtom, true]],
    });

    expect(screen.getAllByRole("alert")).toHaveLength(1);
  });

  it("dispatches submit to the ViewModel", async () => {
    const user = userEvent.setup();
    const { registry } = renderView(<AddTodo orgId={TEST_ORG_ID} />, {
      initialValues: [[fieldsAtom, { title: "Buy milk" }]],
    });

    await user.click(screen.getByTestId("add-todo-submit"));

    expect(registry.get(submitAttemptedAtom)).toBe(true);
  });

  it("disables the button and shows a spinner while the request is in flight", () => {
    renderView(<AddTodo orgId={TEST_ORG_ID} />, {
      initialValues: [[submitAtom, AsyncResult.initial(true)]],
    });

    expect(screen.getByTestId("add-todo-submit")).toBeDisabled();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });
});
