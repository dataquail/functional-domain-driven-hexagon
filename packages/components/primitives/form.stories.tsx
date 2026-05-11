import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";
import { Button } from "./button";
import { Form } from "./form";

const meta = {
  title: "Primitives/Form",
  component: Form,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <Form
      className="w-72"
      onSubmit={() => {
        /* demo */
      }}
    >
      <Form.Control>
        <Form.Label htmlFor="name">Name</Form.Label>
        <Form.Input id="name" placeholder="Ada Lovelace" />
      </Form.Control>
      <Form.Control>
        <Form.Label htmlFor="email" required>
          Email
        </Form.Label>
        <Form.Input id="email" type="email" placeholder="ada@example.com" />
        <Form.Error error="Email is required" />
      </Form.Control>
      <Button type="submit">Submit</Button>
    </Form>
  ),
};

// Play-test: the Form.Error contract is "shows when error is a
// non-empty string, hides when null/empty". Wraps the form in a
// state-toggle so the play function exercises both branches.
const ToggleErrorForm: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);
  return (
    <Form className="w-72" onSubmit={() => undefined}>
      <Form.Control>
        <Form.Label htmlFor="play-email" required>
          Email
        </Form.Label>
        <Form.Input id="play-email" type="email" />
        <Form.Error error={error} />
      </Form.Control>
      <Button
        type="button"
        data-testid="trigger-error"
        onClick={() => {
          setError("Email is required");
        }}
      >
        Trigger error
      </Button>
      <Button
        type="button"
        data-testid="clear-error"
        onClick={() => {
          setError(null);
        }}
      >
        Clear error
      </Button>
    </Form>
  );
};

export const ErrorContract: Story = {
  render: () => <ToggleErrorForm />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("error is hidden initially", async () => {
      // Form.Error renders `null` when error is null/empty — there
      // should be no node with that error message yet.
      await expect(canvas.queryByText("Email is required")).toBeNull();
    });

    await step("error appears after triggering", async () => {
      await userEvent.click(canvas.getByTestId("trigger-error"));
      await expect(await canvas.findByText("Email is required")).toBeInTheDocument();
    });

    await step("error disappears after clearing", async () => {
      await userEvent.click(canvas.getByTestId("clear-error"));
      // Form.Error returns null on empty/null — the node is unmounted.
      await expect(canvas.queryByText("Email is required")).toBeNull();
    });
  },
};
