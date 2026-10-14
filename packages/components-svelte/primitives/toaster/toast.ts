import { toast } from "svelte-sonner";

// The imperative half of the toaster, so the toast library stays behind the
// component library's boundary in both directions.
export type ToastKind = "success" | "error";

export const showToast = (kind: ToastKind, message: string): void => {
  if (kind === "success") toast.success(message);
  else toast.error(message);
};
