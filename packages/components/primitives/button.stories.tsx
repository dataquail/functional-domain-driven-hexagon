import type { Meta, StoryObj } from "@storybook/react-vite";
import * as React from "react";
import { expect, userEvent, within } from "storybook/test";

import { Button } from "./button";

const meta = {
  title: "Primitives/Button",
  component: Button,
  parameters: { layout: "centered" },
  args: { children: "Button" },
  argTypes: {
    variant: {
      control: "select",
      options: ["default", "destructive", "outline", "secondary", "ghost", "link"],
    },
    size: { control: "select", options: ["default", "sm", "lg", "icon"] },
    disabled: { control: "boolean" },
    loading: { control: "boolean" },
  },
} satisfies Meta<typeof Button>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
export const Destructive: Story = { args: { variant: "destructive" } };
export const Outline: Story = { args: { variant: "outline" } };
export const Secondary: Story = { args: { variant: "secondary" } };
export const Ghost: Story = { args: { variant: "ghost" } };
export const Link: Story = { args: { variant: "link" } };
export const Small: Story = { args: { size: "sm" } };
export const Large: Story = { args: { size: "lg" } };
export const Loading: Story = { args: { loading: true } };
export const Disabled: Story = { args: { disabled: true } };

// Play-tests pin three behavioral contracts the Button has beyond
// rendering — click fires onClick, disabled blocks the click, loading
// renders a spinner. Each uses a small state-backed harness so the
// click outcome is observable from the DOM (not just from a closed-over
// spy).

const ClickCounter: React.FC<{ readonly disabled?: boolean }> = ({ disabled = false }) => {
  const [count, setCount] = React.useState(0);
  return (
    <div>
      <Button
        onClick={() => {
          setCount((c) => c + 1);
        }}
        disabled={disabled}
        data-testid="btn"
      >
        Click me
      </Button>
      <span data-testid="click-count">{count}</span>
    </div>
  );
};

export const ClickContract: Story = {
  render: () => <ClickCounter />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("btn");
    const count = canvas.getByTestId("click-count");

    await step("starts at zero", async () => {
      await expect(count).toHaveTextContent("0");
    });

    await step("clicking an enabled button fires onClick once", async () => {
      await userEvent.click(button);
      await expect(count).toHaveTextContent("1");
    });

    await step("repeated clicks accumulate", async () => {
      await userEvent.click(button);
      await userEvent.click(button);
      await expect(count).toHaveTextContent("3");
    });
  },
};

export const DisabledBlocksClick: Story = {
  render: () => <ClickCounter disabled />,
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);
    const button = canvas.getByTestId("btn");
    const count = canvas.getByTestId("click-count");

    await step("button reports disabled and count stays at zero", async () => {
      await expect(button).toBeDisabled();
      // userEvent respects `pointer-events: none` (the disabled class)
      // and refuses to dispatch the click. The promise rejects, which
      // we tolerate; the assertion is on the counter.
      await userEvent.click(button).catch(() => undefined);
      await expect(count).toHaveTextContent("0");
    });
  },
};

export const LoadingRendersSpinner: Story = {
  args: { loading: true },
  play: async ({ canvasElement, step }) => {
    const canvas = within(canvasElement);

    await step("loading prop adds a spinner svg inside the button", async () => {
      // Loader2Icon renders an <svg> with the `animate-spin` class. Pin
      // by class because the icon does not carry a stable test id.
      const button = canvas.getByRole("button");
      const spinner = button.querySelector("svg.animate-spin");
      await expect(spinner).not.toBeNull();
    });
  },
};
