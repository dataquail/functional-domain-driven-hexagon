import { UsersPage } from "@/features/users";
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/users")({
  component: UsersPage,
});
