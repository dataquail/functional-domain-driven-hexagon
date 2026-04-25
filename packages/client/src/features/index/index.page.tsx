import { Button, Card, Skeleton } from "@/components/ui";
import { useEffectMutation } from "@/lib/tanstack-query";
import { TodosQueries } from "@/services/data-access/todos-queries";
import { WorkerClient } from "@/services/worker/worker-client";
import * as Array from "effect/Array";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { toast } from "sonner";
import { AddTodo } from "./add-todo";
import { TodoItem } from "./todo-item";

export const IndexPage = () => {
  const todosQuery = TodosQueries.useTodosQuery();

  const workerMutation = useEffectMutation({
    mutationKey: ["worker"],
    mutationFn: Effect.fnUntraced(function* () {
      const { client } = yield* WorkerClient;

      const largeData = Array.makeBy(1_000_000, (i) => i);
      const filterThreshold = 99_990;

      const [duration, result] = yield* Effect.timed(
        client.filterData({
          data: largeData,
          threshold: filterThreshold,
        }),
      );

      toast.success(`Filtered ${result.length} items in ${Duration.format(duration)}`);
    }),
    toastifyErrors: {
      FilterError: () => "Error filtering data",
    },
  });

  const workerPrimeMutation = useEffectMutation({
    mutationKey: ["worker-primes"],
    mutationFn: Effect.fnUntraced(function* () {
      const { client } = yield* WorkerClient;
      const upperBound = 10_000_000;

      yield* Effect.logInfo(`Requesting prime calculation up to ${upperBound}`);

      const [duration, result] = yield* Effect.timed(client.calculatePrimes({ upperBound }));

      toast.success(`Found ${result} primes in ${Duration.format(duration)}`);
    }),
  });

  return (
    <Card className="mx-auto w-full max-w-lg shadow-md">
      <Card.Header className="pb-2">
        <Card.Title className="text-center text-2xl font-semibold">My Tasks</Card.Title>
      </Card.Header>

      <Card.Content className="space-y-4">
        <AddTodo />

        <div className="mt-2 w-full space-y-2">
          {todosQuery.isLoading ? (
            Array.makeBy(3, (i) => <Skeleton key={i} className="h-12 w-full rounded-md" />)
          ) : todosQuery.data?.length === 0 ? (
            <div className="bg-muted/50 rounded-lg py-8 text-center">
              <p className="text-muted-foreground text-sm">No tasks yet. Add one above!</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {todosQuery.data?.map((todo) => <TodoItem key={todo.id} todo={todo} />)}
            </ul>
          )}
        </div>
      </Card.Content>

      <Card.Footer className="flex gap-2">
        <Button
          onClick={() => {
            workerMutation.mutate(void 0);
          }}
        >
          Filter Data
        </Button>

        <Button
          onClick={() => {
            workerPrimeMutation.mutate(void 0);
          }}
        >
          Calculate Primes
        </Button>
      </Card.Footer>
    </Card>
  );
};
