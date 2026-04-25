import {
  type SpanAttributeValue,
  type SpanAttributesExtractor,
} from "@/platform/span-attributable.js";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

// Each command registers an entry here via TypeScript declaration merging.
// The `command` key holds the command's data type; `output` is the
// full Effect.Effect<Success, Failure, Requirements> the handler returns.
//
// Example (inside the command's source file):
//
//   declare module "@/platform/command-bus.js" {
//     interface CommandRegistry {
//       CreateUserCommand: {
//         command: CreateUserCommand;
//         output: Effect.Effect<UserId, UserAlreadyExists, UserRepository | DomainEventBus>;
//       };
//     }
//   }
//
// This makes `commandBus.execute(CreateUserCommand.make({...}))` return the
// correct typed Effect at call sites, without the bus itself knowing about
// individual commands.
// Intentionally empty — modules extend this via TypeScript declaration merging.
/* eslint-disable @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type */
export interface CommandRegistry {}
/* eslint-enable @typescript-eslint/no-empty-interface, @typescript-eslint/no-empty-object-type */

type RegisteredCommand = CommandRegistry[keyof CommandRegistry] extends {
  readonly command: infer C;
}
  ? C
  : never;

export interface CommandBusShape {
  readonly execute: <C extends RegisteredCommand>(
    cmd: C,
  ) => C extends { readonly _tag: infer T extends keyof CommandRegistry }
    ? CommandRegistry[T] extends { readonly output: infer O }
      ? O
      : never
    : never;
}

export class CommandBus extends Context.Tag("CommandBus")<CommandBus, CommandBusShape>() {}

type CommandFor<T extends keyof CommandRegistry> = CommandRegistry[T] extends {
  readonly command: infer C;
}
  ? C
  : never;

type OutputFor<T extends keyof CommandRegistry> = CommandRegistry[T] extends {
  readonly output: infer O;
}
  ? O
  : never;

/**
 * A single registry entry: the handler that runs the command, plus an
 * optional `spanAttributes` extractor whose result is merged into the
 * bus-level span. The extractor is the type's "sibling" redaction function
 * — it lives next to the schema definition and is composed into the bus
 * here, rather than being a method on the command (which would require
 * class-based commands; we keep them as plain `TaggedStruct` data so they
 * stay serialization-friendly).
 *
 * Returning `{}` (or omitting the extractor entirely) is the safe default
 * — only fields the extractor's author has audited as non-PHI/non-PII
 * should appear in the result.
 */
export type CommandHandlerEntry<T extends keyof CommandRegistry> = {
  readonly handle: (cmd: CommandFor<T>) => OutputFor<T>;
  readonly spanAttributes?: SpanAttributesExtractor<CommandFor<T>>;
};

/**
 * A typed map from command tags to their handler entries. Parameterize `K`
 * to describe a partial contribution (e.g. a single module's handlers);
 * omit it to demand every registered command's entry at once.
 */
export type CommandHandlers<K extends keyof CommandRegistry = keyof CommandRegistry> = {
  readonly [T in K]: CommandHandlerEntry<T>;
};

/**
 * Factory for a module's contribution to the command bus. Checks each
 * key against `CommandRegistry` individually: registered tags must map to
 * the correct entry shape, unknown tags (typos, never-declared commands)
 * must map to `never`, which no entry satisfies.
 */
export const commandHandlers = <
  const M extends {
    readonly [K in keyof M]: K extends keyof CommandRegistry ? CommandHandlerEntry<K> : never;
  },
>(
  map: M,
): M => map;

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
