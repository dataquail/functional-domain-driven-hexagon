import type { Meta, StoryObj } from "@storybook/react-vite";

import { Container } from "../primitives/container";
import { Link } from "../primitives/link";
import { Nav } from "../primitives/nav";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { AppShell } from "./app-shell";

const meta = {
  title: "Patterns/AppShell",
  component: AppShell,
  parameters: { layout: "fullscreen" },
  args: {
    nav: (
      <Nav orientation="block" tone="bar" aria-label="Main">
        <Container width="lg" paddingX="md" paddingY="sm">
          <Stack direction="row" gap="sm" align="center">
            <Link href="#" appearance="nav-item" tone="default" underline="none">
              Home
            </Link>
          </Stack>
        </Container>
      </Nav>
    ),
    children: <Text align="center">Page content</Text>,
  },
} satisfies Meta<typeof AppShell>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {};
