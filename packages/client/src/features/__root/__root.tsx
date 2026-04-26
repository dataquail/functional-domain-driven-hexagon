import { Link, Outlet } from "@tanstack/react-router";
import * as React from "react";

export const RootLayout: React.FC = () => {
  return (
    <main className="bg-background flex min-h-screen flex-col">
      <nav className="bg-card border-b">
        <div className="mx-auto flex max-w-3xl items-center gap-1 px-4 py-3">
          <Link
            to="/"
            className="hover:bg-accent text-foreground [&.active]:bg-accent rounded-md px-3 py-1.5 text-sm font-medium"
          >
            Tasks
          </Link>
          <Link
            to="/users"
            className="hover:bg-accent text-foreground [&.active]:bg-accent rounded-md px-3 py-1.5 text-sm font-medium"
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
