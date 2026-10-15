// Integration tier: the real AddTodo + TodoList pair over MSW.
//
// What this proves that the ViewModel tests do not: a mutation and a query
// that name the same reactivity key actually talk to each other. Nothing in
// either feature file wires that up -- the list refetches because the create
// dirtied `ReactivityKeys.todos`, and if that agreement ever broke the screen
// would go stale with no error anywhere.
//
// Per ADR-0019, handlers are stateless and order-independent; the post-create
// list handler is registered before the interaction because MSW resolves the
// most recently registered handler first.

import { screen, waitFor, within } from "@testing-library/svelte";
import { userEvent } from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { makeTodo } from "@/test/fixtures";
import { handlers } from "@/test/handlers/handler-set";
import { renderWithHarness } from "@/test/integration-harness";
import { server } from "@/test/msw-server";

import TestOrgTasksPage from "./test-org-tasks-page.svelte";

const render = () => {
  const rendered = renderWithHarness(TestOrgTasksPage, {});

  return { ...rendered, user: userEvent.setup() };
};

describe("OrgTasksPage — integration tier", () => {
  it("renders the empty state when the org has no todos", async () => {
    server.use(handlers.auth.signedInAs(), handlers.todos.list([]));

    render();

    expect(await screen.findByText("No tasks yet. Add one above!")).toBeInTheDocument();
  });

  it("shows the new todo in the list after creation", async () => {
    const created = makeTodo({ title: "Buy milk" });

    server.use(handlers.auth.signedInAs(), handlers.todos.list([]), handlers.todos.create());

    const { user } = render();
    await screen.findByText("No tasks yet. Add one above!");

    // Registered after the first load so the refetch -- and only the refetch --
    // sees the new todo. MSW resolves the most recently registered handler first.
    server.use(handlers.todos.list([created]));

    await user.type(screen.getByTestId("add-todo-input"), "Buy milk");
    await user.click(screen.getByTestId("add-todo-submit"));

    const list = await screen.findByTestId("todo-list");
    expect(await within(list).findByText("Buy milk")).toBeInTheDocument();
  });

  it("clears the field and announces the creation", async () => {
    server.use(handlers.auth.signedInAs(), handlers.todos.list([]), handlers.todos.create());

    const { user } = render();
    await screen.findByTestId("add-todo-input");

    await user.type(screen.getByTestId("add-todo-input"), "Buy milk");
    await user.click(screen.getByTestId("add-todo-submit"));

    expect(await screen.findByText("Todo created!")).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByTestId("add-todo-input")).toHaveValue("");
    });
  });

  it("re-reads the list after a todo is completed", async () => {
    const todo = makeTodo({ title: "Buy milk", completed: false });

    server.use(handlers.auth.signedInAs(), handlers.todos.list([todo]), handlers.todos.update());

    const { user } = render();

    const checkbox = await screen.findByRole("checkbox", { name: "Buy milk" });
    expect(checkbox).not.toBeChecked();

    server.use(
      handlers.todos.list([makeTodo({ id: todo.id, title: "Buy milk", completed: true })]),
    );

    await user.click(checkbox);

    await waitFor(() => {
      expect(screen.getByRole("checkbox", { name: "Buy milk" })).toBeChecked();
    });
  });
});
