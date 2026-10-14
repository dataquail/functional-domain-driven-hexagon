<script lang="ts">
  // Device approval (ADR-0005). The CLI's `verification_uri_complete` links
  // here with `?code=XXXX-XXXX`; the authed guard makes sure the grant binds
  // to a signed-in caller.
  import CardSection from "@org/components/patterns/card-section.svelte";
  import PageShell from "@org/components/patterns/page-shell.svelte";
  import Text from "@org/components/primitives/text.svelte";

  import ApproveDevice from "@/features/device/approve-device/approve-device.view.svelte";
  import { page } from "$app/state";
</script>

<PageShell width="xs">
  <CardSection title="Approve a device">
    <Text tone="muted">
      Enter the code shown in your terminal to authorize the CLI on your account.
    </Text>
    <ApproveDevice initialCode={page.url.searchParams.get("code") ?? ""} />
  </CardSection>
</PageShell>
