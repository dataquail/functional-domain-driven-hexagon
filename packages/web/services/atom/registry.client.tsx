"use client";

// The browser's atom registry. Wrapping `RegistryProvider` here is what keeps
// `@effect/atom-react` out of `app/`: routes compose this, not the library.

import "./tracing.client";

import { RegistryProvider } from "@effect/atom-react";
import { Toaster } from "@org/components/primitives/toaster";

import { NavigationBridge } from "./navigation-bridge.client";
import { NotificationBridge } from "./notification-bridge.client";

// Long enough that navigating away and back re-uses a fetched page, short
// enough that a stale page is not served indefinitely.
const IDLE_TTL_MS = 30_000;

export const AtomProvider: React.FC<{ readonly children: React.ReactNode }> = ({ children }) => (
  <RegistryProvider defaultIdleTTL={IDLE_TTL_MS}>
    {children}
    <NavigationBridge />
    <NotificationBridge />
    <Toaster />
  </RegistryProvider>
);
