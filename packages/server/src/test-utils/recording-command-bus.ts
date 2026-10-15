import { type Command, CommandBus } from "@effect-server-utils/cqrs";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

type RecordedDispatch = { readonly tag: string; readonly payload: unknown };

// Test double for `CommandBus`: records every dispatch and returns a no-op success,
// without running any handler. Inbound adapters (HTTP, CLI, event adapters) that dispatch
// commands assert against the recorded log — "given this input, it dispatched command X
// with fields Y" — without wiring the real handler graph. Integration tests that need the
// handler to actually run use the real bus from `makeCommandBus` instead.
export class RecordedCommands extends Context.Service<
  RecordedCommands,
  {
    readonly all: Effect.Effect<ReadonlyArray<RecordedDispatch>>;
    // Takes the command *definition* rather than its tag as a string, so the payloads come
    // back typed and a renamed command breaks the test at compile time.
    readonly payloadsFor: <M extends Command.Any>(
      command: M,
    ) => Effect.Effect<ReadonlyArray<Command.Payload<M>>>;
  }
>()("RecordedCommands") {}

export const RecordingCommandBus: Layer.Layer<CommandBus | RecordedCommands> = Layer.effectContext(
  Effect.gen(function* () {
    const dispatched = yield* Ref.make<ReadonlyArray<RecordedDispatch>>([]);

    return Context.empty().pipe(
      Context.add(
        CommandBus,
        CommandBus.of({
          execute: <M extends Command.Any>(command: M, payload: Command.Payload<M>) =>
            // SAFETY: adapter tests only assert what was dispatched, never what a handler returned.
            // oxlint-disable-next-line effect/noAs, effect/noChainedTypeAssertions, anti-slop/no-chained-type-assertions -- a recorder runs no handler, so it has no typed output to return
            Ref.update(dispatched, (prev) => [
              ...prev,
              { tag: command.tag, payload },
            ]) as unknown as Effect.Effect<Command.Success<M>, Command.Failure<M>>,
          // A recorder answers whatever it is asked, so there is no fixed routing
          // table to report. Tests that need real routing use the production bus.
          tags: new Set<string>(),
        }),
      ),
      Context.add(
        RecordedCommands,
        RecordedCommands.of({
          all: Ref.get(dispatched),
          payloadsFor: <M extends Command.Any>(command: M) =>
            Effect.map(Ref.get(dispatched), (all) =>
              all.flatMap((dispatch) => {
                if (dispatch.tag !== command.tag) return [];

                // SAFETY: the tag matched, and `execute` only records a payload typed for its command.
                // oxlint-disable-next-line effect/noAs -- the log is erased across commands; the tag restores the type
                return [dispatch.payload as Command.Payload<M>];
              }),
            ),
        }),
      ),
    );
  }),
);
