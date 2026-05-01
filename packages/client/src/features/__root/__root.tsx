import { Button } from "@/components/primitives";
import { AuthQueries } from "@/services/data-access/auth-queries";
import { SseQueries } from "@/services/data-access/sse-queries";
import { useRuntime } from "@/services/runtime/use-runtime";
import { Link, Outlet } from "@tanstack/react-router";
import * as React from "react";
import { AuthGuard } from "./auth-guard";

const SignOutButton: React.FC = () => {
  const runtime = useRuntime();
  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      onClick={() => {
        runtime.runFork(AuthQueries.beginLogout);
      }}
      className="ml-auto"
    >
      Sign out
    </Button>
  );
};

export const RootLayout: React.FC = () => {
  return (
    <AuthGuard>
      {/* Only opens the SSE pipe once the user has a session. Mounting it
          above AuthGuard would 401 + retry every 3s on every unauthenticated
          page-load. */}
      <SseQueries.SseConnector />
      <main className="flex min-h-screen flex-col bg-background">
        <nav className="border-b bg-card">
          <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
            <Link
              to="/"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent [&.active]:bg-accent"
            >
              Tasks
            </Link>
            <Link
              to="/users"
              className="rounded-md px-3 py-1.5 text-sm font-medium text-foreground hover:bg-accent [&.active]:bg-accent"
            >
              Users
            </Link>
            <SignOutButton />
          </div>
        </nav>

        <div className="flex flex-1 flex-col py-12">
          <Outlet />
        </div>
      </main>
    </AuthGuard>
  );
};
