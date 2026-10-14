<script lang="ts">
  import { showToast } from "@org/components/primitives/toaster";

  import { atomSubscribe } from "@/services/bridge/atom-bridge.svelte";

  import { type Notification, notificationAtom } from "./notifications.shared";

  // Mounted by the app's provider and by the integration harness, so a toast a
  // ViewModel raises reaches the DOM the same way in both.
  atomSubscribe(notificationAtom, (notification: Notification | null) => {
    if (notification === null) return;
    showToast(notification.kind, notification.message);
  });
</script>
