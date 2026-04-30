import { Button, Card, Skeleton } from "@/components/primitives";
import { AddTodo } from "./add-todo";
import { TodoItem } from "./todo-item";
import { useIndexViewModel } from "./use-index-view-model";

const SKELETON_COUNT = 3;

export const IndexPage = () => {
  const { actions, state } = useIndexViewModel();

  return (
    <Card className="mx-auto w-full max-w-lg shadow-md">
      <Card.Header className="pb-2">
        <Card.Title className="text-center text-2xl font-semibold">My Tasks</Card.Title>
      </Card.Header>

      <Card.Content className="space-y-4">
        <AddTodo />

        <div className="mt-2 w-full space-y-2">
          {state.todos.kind === "loading" ? (
            Array.from({ length: SKELETON_COUNT }, (_, i) => (
              <Skeleton key={i} className="h-12 w-full rounded-md" />
            ))
          ) : state.todos.kind === "error" ? (
            <div className="bg-destructive/10 text-destructive rounded-lg py-8 text-center">
              <p className="text-sm">{state.todos.message}</p>
            </div>
          ) : state.todos.kind === "empty" ? (
            <div className="bg-muted/50 rounded-lg py-8 text-center">
              <p className="text-muted-foreground text-sm">No tasks yet. Add one above!</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="todo-list">
              {state.todos.todos.map((todo) => (
                <TodoItem key={todo.id} todo={todo} />
              ))}
            </ul>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="flex gap-2">
        <Button onClick={actions.filterLargeData} disabled={state.filterPending}>
          Filter Data
        </Button>
        <Button onClick={actions.calculatePrimes} disabled={state.primesPending}>
          Calculate Primes
        </Button>
      </Card.Footer>
    </Card>
  );
};
