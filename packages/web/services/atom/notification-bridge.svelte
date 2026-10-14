<script lang="ts">
  import { showToast } from "@org/components/primitives/toaster";
  import * as Option from "effect/Option";

  import { atomSubscribe } from "@/services/bridge/atom-bridge.svelte";

  import { type Notification, notificationAtom } from "./notifications.shared";

  // Mounted by the app's provider and by the integration harness, so a toast a
  // ViewModel raises reaches the DOM the same way in both.
  atomSubscribe(notificationAtom, (latest: Option.Option<Notification>) => {
    if (Option.isNone(latest)) return;
    showToast(latest.value.kind, latest.value.message);
  });
</script>
