import * as Context from "effect/Context";
import * as Effect from "effect/Effect";

import type * as Command from "./command.js";
import type { DispatchTable } from "./dispatch-table.js";

/**
 * The application-wide write-side bus: one service whose `execute` takes a command
 * *definition* plus that command's payload, and hands back exactly the success and
 * error channels the definition declares.
 *
 *   bus.execute(CreateUser, { email })   // Effect<UserId, UserAlreadyExists | …, never>
 *
 * The signature is read off the definition, so nothing else needs to know it: there is
 * no side table keyed by tag that a command's own declaration could drift from.
 * Requirements are absent by construction rather than stripped — a definition declares
 * no `R`, because a handler's requirements were discharged where its module's dispatch
 * surface was registered.
 *
 * `Command.Any` carries the write side in its type, so a query definition is rejected
 * here and vice versa: the CQRS distinction the two buses exist to express.
 */
export type CommandBusShape = {
  readonly execute: <M extends Command.Any>(
    command: M,
    payload: Command.Payload<M>,
  ) => Effect.Effect<Command.Success<M>, Command.Failure<M>, never>;
};

export class CommandBus extends Context.Service<CommandBus, CommandBusShape>()(
  "@org/cqrs/CommandBus",
) {}

/**
 * Builds a `CommandBus` over a routing table of per-module dispatchers. The bus's whole
 * job is to hand a payload to the module that owns the command's tag.
 *
 * No span is opened here. Each dispatcher opens its own `command.<tag>` span and
 * annotates it from the tag's registered extractor, so wrapping one at this level would
 * double every dispatch.
 *
 * The table is erased — a tag to a dispatch function. It does not restate any command's
 * signature, because `execute` reads that off the definition the caller passes, and each
 * module's handler registration already checked its handlers against the same
 * definitions. A tag absent from the table is a wiring error, caught at dispatch.
 *
 * Belongs where an application is composed. It takes the whole routing table, so
 * anything else that built one could answer a message with a different module's handler
 * than the composed application would.
 */
export const makeCommandBus = (dispatch: DispatchTable): CommandBusShape => ({
  execute: ((command: { readonly tag: string }, payload: never) => {
    const dispatcher = dispatch[command.tag];
    if (dispatcher === undefined) {
      return Effect.die(new Error(`[CommandBus] no handler registered for '${command.tag}'`));
    }
    return dispatcher(payload);
  }) as CommandBusShape["execute"],
});
