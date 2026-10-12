<script lang="ts">
  import Button from "@org/components/primitives/button.svelte";
  import Stack from "@org/components/primitives/stack.svelte";
  import Text from "@org/components/primitives/text.svelte";

  import { atomSet, atomValue } from "@/services/bridge/atom-bridge.svelte";

  import { acceptAtom, isAcceptingAtom } from "./accept-invitation.view-model";

  const { token }: { readonly token: string } = $props();

  const isAccepting = atomValue(isAcceptingAtom);
  const accept = atomSet(acceptAtom);
</script>

<Stack direction="column" gap="lg">
  <Text tone="muted">You've been invited to join an organization. Click below to accept.</Text>
  <Button
    width="full"
    onClick={() => {
      accept(token);
    }}
    disabled={isAccepting.current}
    data-testid="invitation-accept"
  >
    {isAccepting.current ? "Accepting…" : "Accept invitation"}
  </Button>
</Stack>
