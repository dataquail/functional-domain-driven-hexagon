import { Toast } from "@/services/common/toast";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Ref from "effect/Ref";

export type ToastCall = { readonly kind: "success" | "error"; readonly message: string };

export class RecordedToasts extends Context.Tag("RecordedToasts")<
  RecordedToasts,
  {
    readonly all: Effect.Effect<ReadonlyArray<ToastCall>>;
  }
>() {}

export const RecordingToast: Layer.Layer<Toast | RecordedToasts> = Layer.effectContext(
  Effect.gen(function* () {
    const recorded = yield* Ref.make<ReadonlyArray<ToastCall>>([]);

    return Context.empty().pipe(
      Context.add(Toast, {
        success: (message: string) =>
          Ref.update(
            recorded,
            (calls): ReadonlyArray<ToastCall> => [...calls, { kind: "success", message }],
          ),
        error: (message: string) =>
          Ref.update(
            recorded,
            (calls): ReadonlyArray<ToastCall> => [...calls, { kind: "error", message }],
          ),
      } as unknown as Toast),
      Context.add(RecordedToasts, {
        all: Ref.get(recorded),
      }),
    );
  }),
);
