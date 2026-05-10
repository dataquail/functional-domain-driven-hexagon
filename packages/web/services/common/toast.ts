import * as Effect from "effect/Effect";
import { toast } from "sonner";

export class Toast extends Effect.Service<Toast>()("@/common/Toast", {
  effect: Effect.succeed({
    success: (message: string) =>
      Effect.sync(() => {
        toast.success(message);
      }),
    error: (message: string) =>
      Effect.sync(() => {
        toast.error(message);
      }),
  }),
}) {}
