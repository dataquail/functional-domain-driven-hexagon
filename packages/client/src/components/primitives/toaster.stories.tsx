import type { Meta, StoryObj } from "@storybook/react-vite";
import { toast } from "sonner";
import { Button } from "./button";
import { Toaster } from "./toaster";

const Demo = () => (
  <div className="flex flex-col items-center gap-2">
    <Toaster />
    <div className="flex gap-2">
      <Button onClick={() => toast.success("Saved")}>Success</Button>
      <Button variant="destructive" onClick={() => toast.error("Something went wrong")}>
        Error
      </Button>
      <Button variant="outline" onClick={() => toast("Plain message")}>
        Default
      </Button>
    </div>
  </div>
);

const meta = {
  title: "Primitives/Toaster",
  component: Demo,
  parameters: { layout: "centered" },
} satisfies Meta<typeof Demo>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
