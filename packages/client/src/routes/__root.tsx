import { RootLayout } from "@/features/__root";
import { createRootRoute } from "@tanstack/react-router";

export const Route = createRootRoute({
  component: RootLayout,
});
