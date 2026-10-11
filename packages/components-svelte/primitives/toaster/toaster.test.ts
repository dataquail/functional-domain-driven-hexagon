import { render, screen, waitFor } from "@testing-library/svelte";
import { describe, expect, it } from "vitest";

import { dismissToasts, showToast } from "./toast";
import Toaster from "./toaster.svelte";

// The test drivers find a toast by `[data-sonner-toast][data-type]`, so the
// Svelte toaster has to render the same attributes sonner does.
describe("Toaster", () => {
  it("renders a success toast the drivers can find", async () => {
    render(Toaster);

    showToast("success", "User created!");

    const toast = await screen.findByText("User created!");
    expect(toast.closest('[data-sonner-toast][data-type="success"]')).not.toBeNull();
  });

  it("renders an error toast the drivers can find", async () => {
    render(Toaster);

    showToast("error", "Something went wrong");

    const toast = await screen.findByText("Something went wrong");
    expect(toast.closest('[data-sonner-toast][data-type="error"]')).not.toBeNull();
  });

  it("dismisses every toast it shows", async () => {
    render(Toaster);
    showToast("success", "Dismiss me");
    await screen.findByText("Dismiss me");

    dismissToasts();

    await waitFor(() => {
      expect(screen.queryByText("Dismiss me")).toBeNull();
    });
  });
});
