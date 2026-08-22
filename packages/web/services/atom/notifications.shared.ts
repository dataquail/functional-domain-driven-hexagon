// Notifications as state rather than as an injected service.
//
// The old `Toast` service had to be threaded through every mutation's
// requirement channel and stubbed in every test. Modelling the latest
// notification as an atom instead means a ViewModel action writes to the graph
// it already has a handle on, a test reads it back with `registry.get`, and the
// sonner call site is one subscriber at the edge of the app.

import * as Effect from "effect/Effect";
import * as Atom from "effect/unstable/reactivity/Atom";

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
export const notificationAtom = Atom.keepAlive(Atom.make<Notification | null>(null));

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
  const previous = get(notificationAtom);
  get.set(notificationAtom, {
    seq: (previous?.seq ?? 0) + 1,
    kind: input.kind,
    message: input.message,
  });
};

const DEFAULT_ERROR_MESSAGE = "Something went wrong";

type TaggedError = { readonly _tag: string };

export type NotifyConfig<A, E extends TaggedError> = {
  readonly success?: (value: A) => string;
  readonly errors?: { readonly [Tag in E["_tag"]]?: (error: Extract<E, { _tag: Tag }>) => string };
  readonly otherwise?: string;
};

export const notify =
  <A, E extends TaggedError>(get: NotificationSink, config: NotifyConfig<A, E>) =>
  <R>(self: Effect.Effect<A, E, R>): Effect.Effect<A, E, R> =>
    self.pipe(
      Effect.tap((value) =>
        Effect.sync(() => {
          if (config.success === undefined) return;
          pushNotification(get, { kind: "success", message: config.success(value) });
        }),
      ),
      Effect.tapError((error) =>
        Effect.sync(() => {
          const handler = config.errors?.[error._tag as E["_tag"]];
          const message =
            handler !== undefined
              ? handler(error as Extract<E, { _tag: E["_tag"] }>)
              : (config.otherwise ?? DEFAULT_ERROR_MESSAGE);
          pushNotification(get, { kind: "error", message });
        }),
      ),
    );
