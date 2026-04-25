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

/**
 * The exact signature a handler for a specific command tag must have —
 * parameter type and return type are both derived from the registry entry
 * for that tag.
 */
export type CommandHandlerFor<T extends keyof CommandRegistry> = (
  cmd: CommandRegistry[T] extends { readonly command: infer C } ? C : never,
) => CommandRegistry[T] extends { readonly output: infer O } ? O : never;

/**
 * A typed map from command tags to their handlers. Parameterize `K` to
 * describe a partial contribution (e.g. a single module's handlers); omit
 * it to demand every registered command's handler at once.
 */
export type CommandHandlers<K extends keyof CommandRegistry = keyof CommandRegistry> = {
  readonly [T in K]: CommandHandlerFor<T>;
};

/**
 * Builds a CommandBus from a full handler set. Takes `CommandHandlers` for
 * the entire `CommandRegistry`, so forgetting to register a handler — or
 * registering the wrong one under a tag — fails to compile.
 */
export const makeCommandBus = (handlers: CommandHandlers): CommandBusShape => ({
  execute: ((cmd: { readonly _tag: string }) => {
    const handler = (handlers as Record<string, CommandHandlerFor<keyof CommandRegistry>>)[
      cmd._tag
    ];
    if (handler === undefined) {
      return Effect.die(new Error(`[CommandBus] no handler registered for '${cmd._tag}'`));
    }
    return handler(cmd as never);
  }) as CommandBusShape["execute"],
});
