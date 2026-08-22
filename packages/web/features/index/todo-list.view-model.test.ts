import * as TodosContract from "@org/contracts/api/TodosContract";
import { OrganizationId } from "@org/contracts/EntityIds";
import * as Effect from "effect/Effect";
import type * as AsyncResult from "effect/unstable/reactivity/AsyncResult";
import type * as Atom from "effect/unstable/reactivity/Atom";
import * as AtomRegistry from "effect/unstable/reactivity/AtomRegistry";
import { describe, expect, it } from "vitest";

import { apiTransportAtom } from "@/services/atom/api-transport.shared";
import { makeTodo, TEST_ORG_ID } from "@/test/fixtures/todo";
import { todosHandlers } from "@/test/handlers/todos";
import { server } from "@/test/msw-server";
import { getEndpoint, TEST_API_BASE, typedHandler } from "@/test/typed-handler";

import { todoListAtom, todosResultAtom } from "./todo-list.view-model";

const OTHER_ORG_ID = OrganizationId.make("55555555-5555-5555-5555-555555555555");

const makeRegistry = () =>
  AtomRegistry.make({
    initialValues: [[apiTransportAtom, { baseUrl: TEST_API_BASE, headers: {} }]],
  });

const settle = <A, E>(
  registry: AtomRegistry.AtomRegistry,
  atom: Atom.Atom<AsyncResult.AsyncResult<A, E>>,
) => Effect.runPromise(AtomRegistry.getResult(registry, atom, { suspendOnWaiting: true }));

describe("todo list ViewModel", () => {
  it("fetches the org's todos", async () => {
    server.use(todosHandlers.list([makeTodo({ title: "Buy milk" })]));

    const registry = makeRegistry();
    const todos = await settle(registry, todosResultAtom(TEST_ORG_ID));

    expect(todos.map((todo) => todo.title)).toEqual(["Buy milk"]);
  });

  it("reports emptiness only once a page has actually arrived", async () => {
    server.use(todosHandlers.list([]));

    const registry = makeRegistry();
    // Before the request settles there is no answer yet, and "no answer" must
    // not render as "no tasks" -- that flashes an empty state over a full list.
    expect(registry.get(todoListAtom(TEST_ORG_ID)).isEmpty).toBe(false);

    await settle(registry, todosResultAtom(TEST_ORG_ID));

    expect(registry.get(todoListAtom(TEST_ORG_ID)).isEmpty).toBe(true);
  });

  it("is not empty when the org has todos", async () => {
    server.use(todosHandlers.list([makeTodo()]));

    const registry = makeRegistry();
    await settle(registry, todosResultAtom(TEST_ORG_ID));

    expect(registry.get(todoListAtom(TEST_ORG_ID)).isEmpty).toBe(false);
  });

  it("scopes the query to the org, so two orgs do not share one slot", async () => {
    const requestedOrgs: Array<string> = [];
    server.use(
      typedHandler(getEndpoint(TodosContract.Group, "get"), ({ path }) => {
        requestedOrgs.push(path.orgId);
        return Effect.succeed([makeTodo({ title: path.orgId })]);
      }),
    );

    const registry = makeRegistry();
    const mine = await settle(registry, todosResultAtom(TEST_ORG_ID));
    const theirs = await settle(registry, todosResultAtom(OTHER_ORG_ID));

    expect(requestedOrgs).toEqual([TEST_ORG_ID, OTHER_ORG_ID]);
    expect(mine[0]?.title).toBe(TEST_ORG_ID);
    expect(theirs[0]?.title).toBe(OTHER_ORG_ID);
  });
});
