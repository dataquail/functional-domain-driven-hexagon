import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, waitFor, within } from "storybook/test";

import { Button } from "./button";
import { Dialog } from "./dialog";
import { Text } from "./text";

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
  args: {
    open: true,
    onOpenChange: () => undefined,
    title: "Delete organization",
    description: "This cannot be undone.",
  },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

// Openness is a prop, so the app's own state lives wherever it belongs — an atom
// in a ViewModel — rather than hidden inside the primitive.
const Controlled: React.FC<{ readonly withFooter?: boolean }> = ({ withFooter = false }) => {
  const [open, setOpen] = React.useState(false);
  return (
    <React.Fragment>
      <Button
        data-testid="open-dialog"
        onClick={() => {
          setOpen(true);
        }}
      >
        Open
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Delete organization"
        description="This cannot be undone."
        data-testid="demo-dialog"
        footer={
          withFooter ? (
            <React.Fragment>
              <Button
                variant="ghost"
                onClick={() => {
                  setOpen(false);
                }}
              >
                Cancel
              </Button>
              <Button variant="destructive">Delete</Button>
            </React.Fragment>
          ) : undefined
        }
      >
        <Text tone="muted">Every todo in this organization goes with it.</Text>
      </Dialog>
    </React.Fragment>
  );
};

export const Open: Story = {
  render: (args) => (
    <Dialog {...args}>
      <Text tone="muted">Every todo in this organization goes with it.</Text>
    </Dialog>
  ),
};

export const WithActions: Story = { render: () => <Controlled withFooter /> };

// Play-test: the dialog opens on demand and the built-in close affordance
// dismisses it. A modal you cannot dismiss is a bug, not a variant.
export const OpenAndDismiss: Story = {
  render: () => <Controlled />,
  play: async ({ canvasElement }) => {
    const canvas = within(canvasElement);
    await userEvent.click(canvas.getByTestId("open-dialog"));

    // Radix portals the content outside the canvas element.
    const dialog = await within(document.body).findByRole("dialog");
    await expect(dialog).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole("button", { name: "Close" }));
    await waitFor(async () => {
      await expect(within(document.body).queryByRole("dialog")).toBeNull();
    });
  },
};
