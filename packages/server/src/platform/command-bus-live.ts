import {
  type CommandBusShape,
  type CommandHandlerEntry,
  type CommandHandlers,
  type CommandRegistry,
} from "@/platform/ddd/command-bus.js";
import { type SpanAttributeValue } from "@/platform/ddd/span-attributable.js";
import * as Effect from "effect/Effect";

/**
 * Builds a CommandBus from a full handler set. Takes `CommandHandlers` for
 * the entire `CommandRegistry`, so forgetting to register a handler — or
 * registering the wrong one under a tag — fails to compile. The bus
 * attaches the bus-level span (`command:<tag>`), invokes the handler, and
 * merges any per-command attributes contributed by `spanAttributes`.
 */
export const makeCommandBus = (handlers: CommandHandlers): CommandBusShape => ({
  execute: ((cmd: { readonly _tag: string }) => {
    const entry = (handlers as Record<string, CommandHandlerEntry<keyof CommandRegistry>>)[
      cmd._tag
    ];
    if (entry === undefined) {
      return Effect.die(new Error(`[CommandBus] no handler registered for '${cmd._tag}'`));
    }
    const extra: Record<string, SpanAttributeValue> =
      entry.spanAttributes !== undefined ? entry.spanAttributes(cmd as never) : {};
    return (entry.handle(cmd as never) as Effect.Effect<unknown, unknown, unknown>).pipe(
      Effect.withSpan(`command:${cmd._tag}`, {
        attributes: { "command.tag": cmd._tag, ...extra },
      }),
    );
  }) as CommandBusShape["execute"],
});
