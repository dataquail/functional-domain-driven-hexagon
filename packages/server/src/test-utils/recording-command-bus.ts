import { type Command, CommandBus, type CommandBusShape } from "@org/cqrs";
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
          // The recorder ignores the typed per-command output and returns a void success;
          // adapter tests only assert what was dispatched.
          execute: ((command: { readonly tag: string }, payload: unknown) =>
            Ref.update(dispatched, (prev) => [
              ...prev,
              { tag: command.tag, payload },
            ])) as CommandBusShape["execute"],
        }),
      ),
      Context.add(RecordedCommands, {
        all: Ref.get(dispatched),
        payloadsFor: <M extends Command.Any>(command: M) =>
          Effect.map(
            Ref.get(dispatched),
            (all) =>
              all.filter((d) => d.tag === command.tag).map((d) => d.payload) as ReadonlyArray<
                Command.Payload<M>
              >,
          ),
      }),
    );
  }),
);
