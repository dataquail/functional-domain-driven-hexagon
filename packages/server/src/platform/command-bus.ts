import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

// Each command registers an entry here via TypeScript declaration merging.
// The `command` key holds the command's data type; `output` is the
// full Effect.Effect<Success, Failure, Requirements> the handler returns.
//
// Example (inside the command's source file):
//
//   declare module "@/platform/command-bus" {
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

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyHandler = (cmd: any) => Effect.Effect<unknown, unknown, unknown>;

/**
 * Builds a CommandBus shape from a map of `{ tag: handler }`. Missing tags
 * dispatch to Effect.die at runtime — this is a surface for a smoke test
 * that asserts every declared CommandRegistry key has a registered handler.
 */
export const makeCommandBus = (handlers: Record<string, AnyHandler>): CommandBusShape => ({
  execute: ((cmd: { readonly _tag: string }) => {
    const handler = handlers[cmd._tag];
    if (handler === undefined) {
      return Effect.die(new Error(`[CommandBus] no handler registered for '${cmd._tag}'`));
    }
    return handler(cmd);
  }) as CommandBusShape["execute"],
});
