import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "./button";
import { Container } from "./container";
import { Form } from "./form";

const meta = {
  title: "Primitives/Form",
  component: Form,
  parameters: { layout: "centered" },
  args: { onSubmit: () => undefined },
} satisfies Meta<typeof Form>;

export default meta;
type Story = StoryObj<typeof meta>;

const DemoForm: React.FC<{ readonly error?: string | null }> = ({ error = null }) => {
  const [name, setName] = React.useState("");
  const [email, setEmail] = React.useState("");
  return (
    <Container width="xs" paddingX="none">
      <Form onSubmit={() => undefined}>
        <Form.Control>
          <Form.Label htmlFor="name">Name</Form.Label>
          <Form.Input
            id="name"
            value={name}
            onChange={(event) => {
              setName(event.target.value);
            }}
            placeholder="Ada Lovelace"
          />
        </Form.Control>
        <Form.Control>
          <Form.Label htmlFor="email" required>
            Email
          </Form.Label>
          <Form.Input
            id="email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
            placeholder="ada@example.com"
          />
          <Form.Error error={error} />
        </Form.Control>
        <Button type="submit">Submit</Button>
      </Form>
    </Container>
  );
};

export const Default: Story = { render: () => <DemoForm /> };
export const WithFieldError: Story = { render: () => <DemoForm error="Email is required" /> };

// Play-test: the Form.Error contract is "shows when error is a non-empty
// string, hides when null/empty". Wraps the form in a state toggle so the play
// function exercises both branches.
const ToggleErrorForm: React.FC = () => {
  const [error, setError] = React.useState<string | null>(null);
  const [email, setEmail] = React.useState("");
  return (
    <Container width="xs" paddingX="none">
      <Form onSubmit={() => undefined}>
        <Form.Control>
          <Form.Label htmlFor="play-email" required>
            Email
          </Form.Label>
          <Form.Input
            id="play-email"
            type="email"
            value={email}
            onChange={(event) => {
              setEmail(event.target.value);
            }}
          />
          <Form.Error error={error} />
        </Form.Control>
        <Button
          data-testid="trigger-error"
          onClick={() => {
            setError("Email is required");
          }}
        >
          Trigger error
        </Button>
        <Button
          data-testid="clear-error"
          onClick={() => {
            setError(null);
          }}
        >
          Clear error
        </Button>
      </Form>
    </Container>
  );
};

export const ErrorContract: Story = {
  render: () => <ToggleErrorForm />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("error is hidden initially", async () => {
      // Form.Error renders `null` when error is null/empty — there should be no
      // node with that message yet.
      await expect(canvas.queryByText("Email is required")).toBeNull();
    });

    await step("error appears after triggering", async () => {
      await userEvent.click(canvas.getByTestId("trigger-error"));
      await expect(await canvas.findByText("Email is required")).toBeInTheDocument();
    });

    await step("error disappears after clearing", async () => {
      await userEvent.click(canvas.getByTestId("clear-error"));
      await expect(canvas.queryByText("Email is required")).toBeNull();
    });
  },
};
