"use client";

// Turns notification state into sonner calls. Mounted by `AtomProvider` in the
// app and by the integration harness in tests, so a toast raised by a ViewModel
// reaches the DOM identically in both.

import { useAtomSubscribe } from "@effect/atom-react";
import { showToast } from "@org/components/primitives/toaster";

import { type Notification, notificationAtom } from "./notifications.shared";

export const NotificationBridge: React.FC = () => {
  useAtomSubscribe(notificationAtom, (notification: Notification | null) => {
    if (notification === null) return;
    showToast(notification.kind, notification.message);
  });
  return null;
};
