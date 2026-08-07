import { describe, it } from "@effect/vitest";
import { deepStrictEqual } from "assert";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

import * as Command from "./command.js";
import * as Event from "./event.js";
import * as Query from "./query.js";

const UserId = Schema.String.pipe(Schema.brand("UserId"));

class UserAlreadyExists extends Schema.TaggedErrorClass<UserAlreadyExists>()("UserAlreadyExists", {
  email: Schema.String,
}) {}

/** An aggregate, the kind of thing a payload has no business carrying. */
class WalletRoot {
  constructor(public readonly balance: number) {}
}

const CreateUser = Command.make("CreateUserCommand", {
  payload: {
    email: Schema.String,
    displayName: Schema.NullOr(Schema.String),
    tags: Schema.Array(Schema.String),
    joinedAt: Schema.Date,
  },
  success: UserId,
  failure: UserAlreadyExists,
});

// Declares nothing to report and no handled failure — both channels carry nothing.
const TouchUser = Command.make("TouchUserCommand", { payload: { userId: UserId } });

const FindUser = Query.make("FindUserQuery", {
  payload: { userId: UserId },
  success: Schema.Struct({ email: Schema.String, createdAt: Schema.Date }),
});

const UserCreated = Event.make("UserCreated", { userId: UserId, email: Schema.String });

describe("checkSerializable", () => {
  // Branded ids, nullables, arrays, dates and tagged errors all have JSON forms,
  // so an ordinary contract passes. That is the point: the check should be quiet
  // until someone reaches for an escape hatch.
  it.effect("passes a group whose every channel is JSON-representable", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* Command.checkSerializable(Command.group(CreateUser, TouchUser)), []);
      deepStrictEqual(yield* Query.checkSerializable(Query.group(FindUser)), []);
      deepStrictEqual(yield* Event.checkSerializable([UserCreated]), []);
    }),
  );

  // The realistic way a payload becomes unportable: reaching past the schema
  // language to name a class. It dispatches perfectly in-process, because nothing
  // is ever encoded, and could never be extracted.
  it.effect("catches a payload that smuggles a class instance", () =>
    Effect.gen(function* () {
      const smuggler = Command.make("CreditWalletCommand", {
        payload: { wallet: Schema.instanceOf(WalletRoot), amount: Schema.Number },
      });

      const found = yield* Command.checkSerializable(Command.group(smuggler));

      deepStrictEqual(
        found.map(({ channel, tag }) => ({ channel, tag })),
        [{ channel: "payload", tag: "CreditWalletCommand" }],
      );
    }),
  );

  // The other escape hatch: declaring a channel as `Unknown` types the dispatch
  // but promises nothing, and there is no encoding for a value nobody described.
  it.effect("catches a channel declared as Unknown", () =>
    Effect.gen(function* () {
      const vague = Query.make("FindAnythingQuery", {
        payload: { id: Schema.String },
        success: Schema.Unknown,
      });

      const found = yield* Query.checkSerializable(Query.group(vague));

      deepStrictEqual(
        found.map(({ channel, tag }) => ({ channel, tag })),
        [{ channel: "success", tag: "FindAnythingQuery" }],
      );
    }),
  );

  it.effect("names every offending channel, not just the first", () =>
    Effect.gen(function* () {
      const doubly = Command.make("DoublyOpaqueCommand", {
        payload: { wallet: Schema.instanceOf(WalletRoot) },
        success: Schema.Unknown,
      });

      const found = yield* Command.checkSerializable(Command.group(doubly));

      deepStrictEqual(
        found.map((incompatibility) => incompatibility.channel),
        ["payload", "success"],
      );
    }),
  );

  // A channel that carries nothing has no encoded form at all, so demanding a
  // round-trip would report a problem that does not exist.
  it.effect("says nothing about channels that carry nothing", () =>
    Effect.gen(function* () {
      deepStrictEqual(yield* Command.checkSerializable(Command.group(TouchUser)), []);
    }),
  );

  it.effect("reports a reason a reader can act on", () =>
    Effect.gen(function* () {
      const smuggler = Command.make("CreditWalletCommand", {
        payload: { wallet: Schema.instanceOf(WalletRoot) },
      });

      const found = yield* Command.checkSerializable(Command.group(smuggler));

      deepStrictEqual(
        found.map((incompatibility) => incompatibility.reason.length > 0),
        [true],
      );
    }),
  );
});
