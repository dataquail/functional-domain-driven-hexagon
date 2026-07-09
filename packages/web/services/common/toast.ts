import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { toast } from "sonner";

export class Toast extends Context.Service<
  Toast,
  {
    readonly success: (message: string) => Effect.Effect<void>;
    readonly error: (message: string) => Effect.Effect<void>;
  }
>()("@/common/Toast") {
  public static readonly layer = Layer.succeed(Toast, {
    success: (message: string) =>
      Effect.sync(() => {
        toast.success(message);
      }),
    error: (message: string) =>
      Effect.sync(() => {
        toast.error(message);
      }),
  });
}
