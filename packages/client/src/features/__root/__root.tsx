import { Link, Outlet } from "@tanstack/react-router";
import * as React from "react";

export const RootLayout: React.FC = () => {
  return (
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
        </div>
      </nav>

      <div className="flex flex-1 flex-col py-12">
        <Outlet />
      </div>
    </main>
  );
};
