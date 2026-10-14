import { toast } from "svelte-sonner";

// The imperative half of the toaster, so the toast library stays behind the
// component library's boundary in both directions.
export type ToastKind = "success" | "error";

export const showToast = (kind: ToastKind, message: string): void => {
  if (kind === "success") toast.success(message);
  else toast.error(message);
};

// Toasts live in a module-wide store that outlives any one Toaster, so a harness
// rendering several in a row clears them between renders.
export const dismissToasts = (): void => {
  toast.dismiss();
};
