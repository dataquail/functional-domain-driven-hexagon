"use client";

// Provider stack for the whole app: theme, then the atom registry (which
// carries the router and toast bridges plus the `<Toaster />` they feed).

import { ThemeProvider } from "@org/components/providers/theme-provider";

import { AtomProvider } from "@/services/atom/registry.client";

export const Providers: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <ThemeProvider>
    <AtomProvider>{children}</AtomProvider>
  </ThemeProvider>
);
