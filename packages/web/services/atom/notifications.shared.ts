// Notifications as state rather than as an injected service.
//
// The old `Toast` service had to be threaded through every mutation's
// requirement channel and stubbed in every test. Modelling the latest
// notification as an atom instead means a ViewModel action writes to the graph
// it already has a handle on, a test reads it back with `registry.get`, and the
// sonner call site is one subscriber at the edge of the app.

import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

export type NotificationKind = "success" | "error";

export type Notification = {
  // Two identical messages in a row are two notifications; the sequence is what
  // makes the second one observable.
  readonly seq: number;
  readonly kind: NotificationKind;
  readonly message: string;
};

// Kept alive for the same reason the navigation request is: the bridge is the
// only subscriber, and a notification released before it reads is a toast that
// never appears.
export const notificationAtom = Atom.keepAlive(Atom.make(Option.none<Notification>()));

// The narrow slice of atom context this module needs. Naming it structurally
// rather than as `AtomContext` is what lets a `fn`/`fnSync` action -- whose
// `FnContext` is a different, smaller interface -- pass its own context
// straight through.
export type NotificationSink = {
  <A>(atom: Atom.Atom<A>): A;
  set<R, W>(atom: Atom.Writable<R, W>, value: W): void;
};

export const pushNotification = (
  get: NotificationSink,
  input: { readonly kind: NotificationKind; readonly message: string },
): void => {
  const previousSeq = Option.match(get(notificationAtom), {
    onNone: () => 0,
    onSome: (previous) => previous.seq,
  });

  get.set(
    notificationAtom,
    Option.some({ seq: previousSeq + 1, kind: input.kind, message: input.message }),
  );
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong";

type TaggedError = { readonly _tag: string };

type ErrorMessages<E extends TaggedError> = {
  readonly [Tag in E["_tag"]]?: (error: E & { readonly _tag: Tag }) => string;
};

export type NotifyConfig<A, E extends TaggedError> = {
  readonly success?: (value: A) => string;
  readonly errors?: ErrorMessages<E>;
  readonly otherwise?: string;
};

const messageFor = <E extends TaggedError, Tag extends E["_tag"]>(
  messages: ErrorMessages<E>,
  error: E & { readonly _tag: Tag },
): Option.Option<string> => {
  const describe = messages[error._tag];

  return Option.map(Option.fromUndefinedOr(describe), (handler) => handler(error));
};

const announceSuccess = <A>(
  get: NotificationSink,
  success: Option.Option<(value: A) => string>,
  value: A,
) =>
  Option.match(success, {
    onNone: () => Effect.void,
    onSome: (describe) =>
      Effect.sync(() => {
        pushNotification(get, { kind: "success", message: describe(value) });
      }),
  });

export const notify =
  <A, E extends TaggedError>(get: NotificationSink, config: NotifyConfig<A, E>) =>
  <R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    self.pipe(
      Effect.tap((value) => announceSuccess(get, Option.fromUndefinedOr(config.success), value)),
      Effect.tapError((error) =>
        Effect.sync(() => {
          const message = messageFor(config.errors ?? {}, error).pipe(
            Option.getOrElse(() => config.otherwise ?? DEFAULT_ERROR_MESSAGE),
          );

          pushNotification(get, { kind: "error", message });
        }),
      ),
    );
