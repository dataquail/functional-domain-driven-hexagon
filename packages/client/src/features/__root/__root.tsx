import { Outlet } from "@tanstack/react-router";
import * as React from "react";

export const RootLayout: React.FC = () => {
  return (
    <main className="bg-background flex h-screen flex-col py-24">
      <Outlet />
    </main>
  );
};
