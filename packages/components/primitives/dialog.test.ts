import { render, screen } from "@testing-library/svelte";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";

import { recordCalls } from "../test/calls";
import { textSnippet } from "../test/snippets";
import Dialog from "./dialog.svelte";

describe("Dialog", () => {
  it("renders nothing while closed", () => {
    render(Dialog, { open: false, onOpenChange: () => {}, title: "Delete organization?" });

    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("shows its title, description, body and footer while open", () => {
    render(Dialog, {
      open: true,
      onOpenChange: () => {},
      title: "Delete organization?",
      description: "This cannot be undone.",
      children: textSnippet("Every todo goes with it."),
      footer: textSnippet("Actions"),
      "data-testid": "dialog",
    });

    const dialog = screen.getByRole("dialog", { name: "Delete organization?" });
    expect(dialog).toHaveAccessibleDescription("This cannot be undone.");
    expect(screen.getByTestId("dialog")).toHaveTextContent("Every todo goes with it.");
    expect(screen.getByTestId("dialog")).toHaveTextContent("Actions");
  });

  it("asks its owner to close from the close button", async () => {
    const onOpenChange = recordCalls<[boolean]>();
    render(Dialog, {
      open: true,
      onOpenChange: onOpenChange.callback,
      title: "Delete organization?",
    });

    await userEvent.click(screen.getByRole("button", { name: "Close" }));

    expect(onOpenChange.calls).toEqual([[false]]);
  });
});
