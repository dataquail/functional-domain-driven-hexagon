<script lang="ts">
  // Inside the authed group, so an unauthenticated invitee signs in through the
  // BFF and lands back here ready to accept.
  import CardSection from "@org/components-svelte/patterns/card-section.svelte";
  import PageShell from "@org/components-svelte/patterns/page-shell.svelte";

  import AcceptInvitation from "@/features/invite/accept-invitation/accept-invitation.view.svelte";
  import { page } from "$app/state";
</script>

<PageShell width="xs">
  <CardSection title="You're invited">
    <AcceptInvitation token={page.params.token ?? ""} />
  </CardSection>
</PageShell>
