import type { Meta, StoryObj } from "@storybook/react-vite";
import { expect, userEvent, waitFor, within } from "storybook/test";
import { Button } from "./button";
import { Dialog } from "./dialog";

const meta = {
  title: "Primitives/Dialog",
  component: Dialog,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Dialog>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger asChild>
        <Button variant="outline">Open dialog</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Are you sure?</Dialog.Title>
          <Dialog.Description>This action cannot be undone.</Dialog.Description>
        </Dialog.Header>
        <Dialog.Footer className="justify-end gap-2">
          <Dialog.Close asChild>
            <Button variant="ghost">Cancel</Button>
          </Dialog.Close>
          <Button variant="destructive">Delete</Button>
        </Dialog.Footer>
      </Dialog.Content>
    </Dialog>
  ),
};

export const OpenByDefault: Story = {
  render: () => (
    <Dialog defaultOpen>
      <Dialog.Trigger asChild>
        <Button variant="outline">Reopen</Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Welcome</Dialog.Title>
          <Dialog.Description>This dialog renders open for visual review.</Dialog.Description>
        </Dialog.Header>
      </Dialog.Content>
    </Dialog>
  ),
};

// Play-test: clicking the trigger opens the dialog, Escape closes
// it. Covers the keyboard-dismiss path users rely on.
export const OpenAndCloseViaEscape: Story = {
  render: () => (
    <Dialog>
      <Dialog.Trigger asChild>
        <Button variant="outline" data-testid="play-trigger">
          Open dialog
        </Button>
      </Dialog.Trigger>
      <Dialog.Content>
        <Dialog.Header>
          <Dialog.Title>Confirm</Dialog.Title>
          <Dialog.Description>Press Escape to dismiss.</Dialog.Description>
        </Dialog.Header>
      </Dialog.Content>
    </Dialog>
  ),
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    // Radix portals the dialog into document.body, so reach for the
    // body scope when asserting on dialog presence.
    const body = within(canvasElement.ownerDocument.body);

    await step("dialog is not in the document before clicking the trigger", async () => {
      await expect(body.queryByRole("dialog")).toBeNull();
    });

    await step("clicking the trigger opens the dialog", async () => {
      await userEvent.click(canvas.getByTestId("play-trigger"));
      await expect(await body.findByRole("dialog")).toBeInTheDocument();
    });

    await step("pressing Escape dismisses the dialog", async () => {
      await userEvent.keyboard("{Escape}");
      // waitFor retries on synchronous throws; we void-cast the
      // assertion to satisfy no-floating-promises (the assertion's
      // promise is for chained matchers, which we don't need here).
      await waitFor(() => {
        void expect(body.queryByRole("dialog")).toBeNull();
      });
    });
  },
};
