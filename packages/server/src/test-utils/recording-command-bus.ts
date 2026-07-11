import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

import { CommandBus, type CommandBusShape } from "@/platform/ddd/ports/command-bus.js";

type RecordedCommand = { readonly _tag: string };

// Test double for `CommandBus`: records every executed command and returns
// a no-op success, without running any handler. Inbound adapters (HTTP,
// CLI, event adapters) that dispatch commands assert against the recorded
// log — "given this input, it dispatched command X with fields Y" — without
// wiring the real handler graph. Integration tests that need the handler to
// actually run use the real bus from `makeCommandBus` instead.
export class RecordedCommands extends Context.Service<
  RecordedCommands,
  {
    readonly all: Effect.Effect<ReadonlyArray<RecordedCommand>>;
    readonly byTag: <C extends RecordedCommand>(tag: C["_tag"]) => Effect.Effect<ReadonlyArray<C>>;
  }
>()("RecordedCommands") {}

export const RecordingCommandBus: Layer.Layer<CommandBus | RecordedCommands> = Layer.effectContext(
  Effect.gen(function* () {
    const executed = yield* Ref.make<ReadonlyArray<RecordedCommand>>([]);

    return Context.empty().pipe(
      Context.add(
        CommandBus,
        CommandBus.of({
          // The recorder ignores the typed per-command output and returns a
          // void success; adapter tests only assert what was dispatched.
          execute: ((cmd: RecordedCommand) =>
            Ref.update(executed, (prev) => [...prev, cmd])) as CommandBusShape["execute"],
        }),
      ),
      Context.add(RecordedCommands, {
        all: Ref.get(executed),
        byTag: <C extends RecordedCommand>(tag: C["_tag"]) =>
          Effect.map(
            Ref.get(executed),
            (cmds) => cmds.filter((c) => c._tag === tag) as unknown as ReadonlyArray<C>,
          ),
      }),
    );
  }),
);
